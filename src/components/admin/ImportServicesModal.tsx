import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [isRevalidating, setIsRevalidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = preview.filter(r => r.errors.length === 0);
  const invalidRows = preview.filter(r => r.errors.length > 0);

  const validateRows = async (rows: PreviewRow[]): Promise<PreviewRow[]> => {
    const { data: existingServices, error } = await supabase
      .from('services')
      .select('name');
    if (error) throw new Error(error.message);

    const existingNames = new Set(existingServices.map(s => s.name?.toLowerCase().trim()));

    return rows.map(row => {
      const data = row.data;
      const errors: string[] = [];

      const name = data.name?.trim();
      if (!name) errors.push('Missing Service Name');
      else if (existingNames.has(name.toLowerCase().trim())) errors.push('Duplicate Name (already exists)');

      if (!data.service_code?.trim()) errors.push('Missing Code');
      if (!data.category) errors.push('Missing Category');

      const price = parseFloat(data.base_price);
      if (isNaN(price) || price < 0) errors.push('Invalid Price');

      return { ...row, errors };
    });
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

      const mapped: PreviewRow[] = rawRows.map((row, idx) => ({
        index: idx + 1,
        data: {
          service_code: row['Code'] || row['service_code'] || null,
          name: row['Service'] || row['name'] || null,
          category: row['Category'] || row['category'] || null,
          description: row['Description'] || row['description'] || null,
          short_description: row['Short Description'] || row['short_description'] || null,
          base_price: row['Price (Ksh)'] || row['base_price'] || '0',
          pricing_unit: row['Pricing Unit'] || row['pricing_unit'] || null,
          estimated_duration: row['Estimated Duration'] || row['estimated_duration'] || null,
          commission_eligible: (row['Commission'] || row['commission_eligible'] || 'No')
            .toString()
            .toLowerCase()
            .trim() === 'yes' ? true : false,
          is_active: (row['Status'] || row['is_active'] || 'Active')
            .toString()
            .toLowerCase()
            .trim() === 'active' ? true : false,
        },
        errors: [],
      }));

      const validated = await validateRows(mapped);
      setPreview(validated);
    } catch (err: any) {
      toast({ title: 'Failed to parse file', description: err.message, variant: 'destructive' });
      setPreview([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleRevalidate = async () => {
    setIsRevalidating(true);
    try {
      const validated = await validateRows(preview);
      setPreview(validated);
      toast({ title: 'Revalidation complete', description: `${validated.filter(r => r.errors.length === 0).length} valid, ${validated.filter(r => r.errors.length > 0).length} invalid.` });
    } catch (err: any) {
      toast({ title: 'Revalidation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRevalidating(false);
    }
  };

  const updateRowData = (index: number, field: string, value: any) => {
    setPreview(prev => prev.map(row => {
      if (row.index === index) {
        return {
          ...row,
          data: { ...row.data, [field]: value }
        };
      }
      return row;
    }));
  };

  const confirmImport = async () => {
    const rowsToInsert = preview.filter(r => r.errors.length === 0).map(r => r.data);
    if (rowsToInsert.length === 0) {
      toast({ title: 'No valid rows to import', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    let created = 0;
    const failedRows: string[] = [];

    try {
      for (const row of rowsToInsert) {
        const payload = {
          name: row.name,
          description: row.description || '',
          base_price: parseFloat(row.base_price) || 0,
          category: row.category,
          commission_eligible: row.commission_eligible ?? true,
          pricing_model: 'fixed',
          pricing_unit: 'fixed',
          input_type: 'number',
          service_code: row.service_code || null,
          short_description: row.short_description || null,
          estimated_duration: row.estimated_duration ? parseInt(row.estimated_duration) : null,
          is_active: row.is_active ?? true,
        };

        const { error } = await supabase.from('services').insert(payload);

        if (error) {
          failedRows.push(`${row.name || 'Unnamed'}: ${error.message}`);
        } else {
          created++;
        }
      }

      const skipped = preview.length - rowsToInsert.length;
      toast({
        title: failedRows.length ? 'Import completed with errors' : 'Import successful',
        description: `${created} service(s) imported. ${skipped} row(s) skipped.${
          failedRows.length ? ` ${failedRows.length} failed.` : ''
        }`,
        variant: failedRows.length ? 'destructive' : 'default',
      });

      if (failedRows.length) {
        console.error('Rows that failed to import:', failedRows);
      }

      setPreview([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Import error:', err);
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
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

  const EditableCell = ({ row, field, type = 'text' }: { row: PreviewRow; field: string; type?: 'text' | 'number' | 'checkbox' }) => {
    const value = row.data[field];
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => updateRowData(row.index, field, e.target.checked)}
          className="h-4 w-4"
        />
      );
    }
    return (
      <Input
        type={type}
        value={value || ''}
        onChange={(e) => updateRowData(row.index, field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
        className="w-full min-w-[80px] text-sm"
      />
    );
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

        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                parseFile(f);
              }
            }}
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
            <div className="mt-2 text-sm">
              <span className="text-green-600">{validRows.length} valid</span>
              {' · '}
              <span className="text-red-600">{invalidRows.length} invalid</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevalidate}
                disabled={isRevalidating}
                className="ml-4"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRevalidating ? 'animate-spin' : ''}`} />
                Revalidate
              </Button>
            </div>
          )}
        </div>

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
                    {validRows.map((r) => (
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
                  </TableBody>
                </Table>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Invalid Rows ({invalidRows.length}) – edit, then revalidate
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
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.map((r) => (
                        <TableRow key={r.index}>
                          <TableCell>{r.index}</TableCell>
                          <TableCell><EditableCell row={r} field="service_code" /></TableCell>
                          <TableCell><EditableCell row={r} field="name" /></TableCell>
                          <TableCell><EditableCell row={r} field="category" /></TableCell>
                          <TableCell><EditableCell row={r} field="base_price" type="number" /></TableCell>
                          <TableCell><EditableCell row={r} field="commission_eligible" type="checkbox" /></TableCell>
                          <TableCell><EditableCell row={r} field="is_active" type="checkbox" /></TableCell>
                          <TableCell>
                            <ul className="list-disc list-inside text-xs text-red-500">
                              {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Edit fields, then click "Revalidate".</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={confirmImport}
            disabled={validRows.length === 0 || isImporting || isParsing || isRevalidating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isImporting ? 'Importing...' : `Import ${validRows.length} service(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
