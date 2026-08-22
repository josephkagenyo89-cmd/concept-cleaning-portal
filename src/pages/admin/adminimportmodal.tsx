import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface PreviewRow {
  index: number;
  data: any;
  errors: string[];
}

interface ImportServicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportServicesModal({ open, onOpenChange, onSuccess }: ImportServicesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = preview.filter(r => r.errors.length === 0);
  const invalidRows = preview.filter(r => r.errors.length > 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rawRows: any[] = [];

      if (extension === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim()
        });
        if (result.errors.length) {
          throw new Error(`CSV parsing error: ${result.errors[0].message}`);
        }
        rawRows = result.data;
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(firstSheet);
      } else {
        throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
      }

      if (!rawRows.length) {
        throw new Error('File is empty or has no header row.');
      }

      const mapped: PreviewRow[] = rawRows.map((row, idx) => {
        const baseSlug = (row['Code'] || row['service_code'] || row['Service'] || row['name'] || `svc-${Date.now()}`)
          .toString()
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        const data = {
          service_code: row['Code'] || row['service_code'] || null,
          name: row['Service'] || row['name'] || null,
          category: row['Category'] || row['category'] || null,
          description: row['Description'] || row['description'] || null,
          short_description: row['Short Description'] || row['short_description'] || null,
          base_price: parseFloat(
            (row['Price (Ksh)'] || row['base_price'] || '0')
              .toString()
              .replace(/,/g, '')
              .trim()
          ),
          pricing_unit: row['Pricing Unit'] || row['pricing_unit'] || null,
          estimated_duration: parseInt(
            (row['Estimated Duration'] || row['estimated_duration'] || '0')
              .toString()
              .trim()
          ) || null,
          commission_eligible: (row['Commission'] || row['commission_eligible'] || 'No')
            .toString()
            .toLowerCase()
            .trim() === 'yes' ? true : false,
          is_active: (row['Status'] || row['is_active'] || 'Active')
            .toString()
            .toLowerCase()
            .trim() === 'active' ? true : false,
          slug: `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`,
        };

        const errors: string[] = [];
        if (!data.service_code) errors.push('Missing Code');
        if (!data.name) errors.push('Missing Service Name');
        if (!data.category) errors.push('Missing Category');
        if (isNaN(data.base_price) || data.base_price < 0) errors.push('Invalid Price');

        return { index: idx + 1, data, errors };
      });

      setPreview(mapped);
    } catch (err: any) {
      toast({ title: 'Failed to parse file', description: err.message, variant: 'destructive' });
      setPreview([]);
    } finally {
      setIsParsing(false);
    }
  };

  const confirmImport = async () => {
    if (validRows.length === 0) {
      toast({ title: 'No valid rows to import', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    try {
      const rowsToInsert = validRows.map(r => r.data);
      const { data, error } = await supabase.from('services').insert(rowsToInsert).select();

      if (error) throw new Error(error.message);

      toast({
        title: 'Import successful',
        description: `${validRows.length} service(s) imported.`,
      });

      setPreview([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Import failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setPreview([]);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Services
          </DialogTitle>
        </DialogHeader>

        {/* File Input */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="import-file-input"
          />
          <label
            htmlFor="import-file-input"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose CSV or Excel file'}
          </label>
          {isParsing && <p className="mt-2 text-sm text-muted-foreground">Parsing file...</p>}
          {file && !isParsing && preview.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="text-green-600">{validRows.length} valid</span>
              {' · '}
              <span className="text-red-600">{invalidRows.length} invalid</span>
            </p>
          )}
        </div>

        {/* Preview */}
        {preview.length > 0 && !isParsing && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Valid Rows ({validRows.length}) – will be imported
              </h4>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 50).map((r) => (
                      <TableRow key={r.index}>
                        <TableCell>{r.index}</TableCell>
                        <TableCell>{r.data.service_code}</TableCell>
                        <TableCell>{r.data.name}</TableCell>
                        <TableCell>{r.data.category}</TableCell>
                        <TableCell>{r.data.base_price}</TableCell>
                        <TableCell>{r.data.commission_eligible ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{r.data.is_active ? 'Active' : 'Inactive'}</TableCell>
                      </TableRow>
                    ))}
                    {validRows.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          + {validRows.length - 50} more rows...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Invalid Rows ({invalidRows.length}) – will be skipped
                </h4>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Errors</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.map((r) => (
                        <TableRow key={r.index}>
                          <TableCell>{r.index}</TableCell>
                          <TableCell>
                            <ul className="list-disc list-inside text-xs text-red-500">
                              {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            Code: {r.data.service_code || '—'} · Name: {r.data.name || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={confirmImport}
            disabled={validRows.length === 0 || isImporting || isParsing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isImporting ? 'Importing...' : `Import ${validRows.length} service(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}