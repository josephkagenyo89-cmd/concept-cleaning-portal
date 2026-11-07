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
  data: {
    id: string | null;
    service_code: string | null;
    name: string;
    category: string;
    category_id: string;
    description: string;
    short_description: string;
    base_price: string;
    pricing_unit: string;
    estimated_duration: string;
    commission_eligible: boolean;
    is_active: boolean;
    provided: string[];
  };
  errors: string[];
}

interface ImportServicesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';
const parseBoolean = (value: unknown, trueWords: string[]) =>
  trueWords.includes(String(value ?? '').trim().toLowerCase());

export function ImportServicesModal({ open, onOpenChange, onSuccess }: ImportServicesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = preview.filter(row => row.errors.length === 0);
  const invalidRows = preview.filter(row => row.errors.length > 0);
  const updateRows = validRows.filter(row => Boolean(row.data.id)).length;
  const createRows = validRows.length - updateRows;

  const validateRows = async (rows: PreviewRow[]): Promise<PreviewRow[]> => {
    const [{ data: existingServices, error: servicesError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase.from('services').select('id,name'),
      supabase.from('service_categories' as any).select('id,name'),
    ]);
    if (servicesError) throw new Error('Could not check existing services: ' + servicesError.message);
    if (categoriesError) throw new Error('Could not load service categories: ' + categoriesError.message);

    const existingIds = new Set((existingServices || []).map((service: any) => String(service.id)));
    const existingNames = new Set((existingServices || []).map((service: any) => normalize(service.name)));
    const categoryList = (categories || []) as unknown as Array<{ id: string; name: string }>;
    const categoriesById = new Map(categoryList.map(category => [category.id.toLowerCase(), category]));
    const categoriesByName = new Map<string, Array<{ id: string; name: string }>>();
    categoryList.forEach(category => {
      const key = normalize(category.name);
      categoriesByName.set(key, [...(categoriesByName.get(key) || []), category]);
    });

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    return rows.map(row => {
      const data = { ...row.data };
      const errors: string[] = [];
      const id = data.id?.trim() || '';
      const nameKey = normalize(data.name);

      if (!data.name?.trim()) errors.push('Missing Service Name');
      if (id) {
        if (!existingIds.has(id)) errors.push('Service ID was not found; refusing to create a replacement');
        if (seenIds.has(id)) errors.push('Duplicate Service ID in import file');
        seenIds.add(id);
      } else {
        if (existingNames.has(nameKey)) errors.push('Duplicate Name: existing services must include their ID to update');
        if (seenNames.has(nameKey)) errors.push('Duplicate Service Name in import file');
        seenNames.add(nameKey);
        if (!data.service_code?.trim()) errors.push('Missing Code for new service');
      }

      if (!data.category?.trim()) {
        errors.push('Missing Service Category');
      } else if (data.category_id?.trim()) {
        if (!categoriesById.has(data.category_id.trim().toLowerCase())) {
          errors.push('Service Category UUID does not exist in service_categories');
        }
      } else {
        const matches = categoriesByName.get(normalize(data.category)) || [];
        if (matches.length === 1) {
          data.category_id = matches[0].id;
        } else if (matches.length === 0) {
          errors.push('No exact category match found; provide service_category_id explicitly');
        } else {
          errors.push('Category name is ambiguous; provide service_category_id explicitly');
        }
      }

      if (!id || hasValue(data.base_price)) {
        const price = Number(data.base_price);
        if (!Number.isFinite(price) || price < 0) errors.push('Invalid Price');
      }

      return { ...row, data, errors };
    });
  };

  const parseFile = async (selectedFile: File) => {
    setIsParsing(true);
    try {
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      let rawRows: any[] = [];

      if (extension === 'csv') {
        const result = Papa.parse(await selectedFile.text(), {
          header: true,
          skipEmptyLines: true,
          transformHeader: header => header.trim(),
        });
        if (result.errors.length) throw new Error('CSV parsing error: ' + result.errors[0].message);
        rawRows = result.data as any[];
      } else if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
        rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      } else {
        throw new Error('Unsupported file format. Upload CSV or Excel.');
      }

      if (!rawRows.length) throw new Error('File is empty or has no header row.');

      const mapped: PreviewRow[] = rawRows.map((raw, index) => {
        const row: Record<string, any> = {};
        Object.entries(raw).forEach(([key, value]) => { row[key.trim().toLowerCase()] = value; });
        const read = (...keys: string[]) => {
          for (const key of keys) if (hasValue(row[key.toLowerCase()])) return row[key.toLowerCase()];
          return '';
        };
        const provided = Object.keys(row);
        const commissionValue = read('commission', 'commission_eligible');
        const statusValue = read('status', 'is_active');

        return {
          index: index + 1,
          data: {
            id: hasValue(read('id')) ? String(read('id')).trim() : null,
            service_code: hasValue(read('code', 'service_code')) ? String(read('code', 'service_code')).trim() : null,
            name: String(read('service', 'name') || '').trim(),
            category: String(read('service_category', 'category') || '').trim(),
            category_id: String(read('service_category_id', 'category_id') || '').trim(),
            description: String(read('description') || ''),
            short_description: String(read('short description', 'short_description') || ''),
            base_price: String(read('price (ksh)', 'base_price') || ''),
            pricing_unit: String(read('pricing unit', 'pricing_unit') || ''),
            estimated_duration: String(read('estimated duration', 'estimated_duration') || ''),
            commission_eligible: parseBoolean(commissionValue, ['yes', 'true', '1', 'y']),
            is_active: statusValue === '' ? true : parseBoolean(statusValue, ['active', 'yes', 'true', '1', 'y']),
            provided,
          },
          errors: [],
        };
      });

      setPreview(await validateRows(mapped));
    } catch (error: any) {
      toast({ title: 'Failed to parse file', description: error.message, variant: 'destructive' });
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
      toast({
        title: 'Revalidation complete',
        description: validated.filter(row => !row.errors.length).length + ' valid, ' +
          validated.filter(row => row.errors.length > 0).length + ' invalid.',
      });
    } catch (error: any) {
      toast({ title: 'Revalidation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsRevalidating(false);
    }
  };

  const updateRowData = (index: number, field: string, value: any) => {
    setPreview(previous => previous.map(row => row.index === index
      ? { ...row, data: { ...row.data, [field]: value } }
      : row));
  };

  const confirmImport = async () => {
    if (!validRows.length) {
      toast({ title: 'No valid rows to import', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    let created = 0;
    let updated = 0;
    const failedRows: string[] = [];
    const failedIndexes = new Set<number>();

    try {
      for (const { data: row } of validRows) {
        // The live schema currently uses category/category_id. CSV accepts both
        // those legacy headers and service_category/service_category_id aliases.
        const payload: Record<string, any> = {
          name: row.name,
          category: row.category,
          category_id: row.category_id,
        };
        const isProvided = (...keys: string[]) => keys.some(key => row.provided.includes(key));

        if (isProvided('description')) payload.description = row.description;
        if (isProvided('short description', 'short_description')) payload.short_description = row.short_description;
        if (isProvided('price (ksh)', 'base_price')) payload.base_price = Number(row.base_price);
        if (isProvided('code', 'service_code')) payload.service_code = row.service_code || null;
        if (isProvided('pricing unit', 'pricing_unit')) payload.pricing_unit = row.pricing_unit || null;
        if (isProvided('estimated duration', 'estimated_duration')) {
          payload.estimated_duration = row.estimated_duration ? parseInt(row.estimated_duration, 10) : null;
        }
        if (isProvided('commission', 'commission_eligible')) payload.commission_eligible = row.commission_eligible;
        if (isProvided('status', 'is_active')) payload.is_active = row.is_active;

        if (!row.id) {
          payload.description = row.description || '';
          payload.base_price = Number(row.base_price);
          payload.commission_eligible = isProvided('commission', 'commission_eligible') ? row.commission_eligible : true;
          payload.pricing_model = 'fixed';
          payload.pricing_unit = row.pricing_unit || 'fixed';
          payload.input_type = 'number';
          payload.service_code = row.service_code || null;
          payload.short_description = row.short_description || null;
          payload.estimated_duration = row.estimated_duration ? parseInt(row.estimated_duration, 10) : null;
          payload.is_active = isProvided('status', 'is_active') ? row.is_active : true;
        }

        const result = row.id
          ? await supabase.from('services').update(payload as any).eq('id', row.id)
          : await supabase.from('services').insert(payload as any);

        if (result.error) {
          failedRows.push((row.name || 'Unnamed') + ': ' + result.error.message);
          const failedPreviewRow = validRows.find(item => item.data.id === row.id && item.data.name === row.name);
          if (failedPreviewRow) failedIndexes.add(failedPreviewRow.index);
        } else if (row.id) {
          updated++;
        } else {
          created++;
        }
      }

      const skipped = preview.length - validRows.length;
      toast({
        title: failedRows.length ? 'Import completed with errors' : 'Import successful',
        description: created + ' created, ' + updated + ' updated, ' + skipped + ' invalid/skipped.' +
          (failedRows.length ? ' ' + failedRows.length + ' database operation(s) failed.' : ''),
        variant: failedRows.length ? 'destructive' : 'default',
      });
      if (failedRows.length) console.error('Service import failures:', failedRows);

      const remainingRows = [
        ...invalidRows,
        ...validRows.filter(row => failedIndexes.has(row.index)),
      ];
      if (!remainingRows.length) {
        setPreview([]);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onOpenChange(false);
        onSuccess();
      } else {
        // Remove successful rows from the pending preview so a retry cannot
        // accidentally create or update them a second time.
        setPreview(remainingRows);
        try {
          setPreview(await validateRows(remainingRows));
        } catch {
          // Keep the remaining rows visible if revalidation is temporarily unavailable.
        }
      }
    } catch (error: any) {
      console.error('Service import error:', error);
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
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

  const EditableCell = ({ row, field, type = 'text' }: {
    row: PreviewRow;
    field: string;
    type?: 'text' | 'number' | 'checkbox';
  }) => {
    const value = row.data[field as keyof PreviewRow['data']];
    if (type === 'checkbox') {
      return <input type="checkbox" checked={Boolean(value)}
        onChange={event => updateRowData(row.index, field, event.target.checked)} className="h-4 w-4" />;
    }
    return <Input type={type} value={String(value ?? '')}
      onChange={event => updateRowData(row.index, field, event.target.value)}
      className="w-full min-w-[100px] text-sm" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import / Update Services
          </DialogTitle>
        </DialogHeader>

        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
            onChange={event => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) {
                setFile(selectedFile);
                void parseFile(selectedFile);
              }
            }} className="hidden" id="import-file-input" />
          <label htmlFor="import-file-input"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100">
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose CSV or Excel file'}
          </label>
          {isParsing && <p className="mt-2 text-sm text-muted-foreground">Parsing file...</p>}
          {file && !isParsing && preview.length > 0 && (
            <div className="mt-2 text-sm">
              <span className="text-green-600">{validRows.length} valid</span>
              {' · '}
              <span className="text-red-600">{invalidRows.length} invalid</span>
              {' · '}
              <span>{updateRows} updates</span>
              {' · '}
              <span>{createRows} new</span>
              <Button variant="ghost" size="sm" onClick={handleRevalidate}
                disabled={isRevalidating || isImporting} className="ml-4">
                <RefreshCw className={'h-4 w-4 mr-1 ' + (isRevalidating ? 'animate-spin' : '')} />
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
                Valid rows — {updateRows} updates, {createRows} new services
              </h4>
              <div className="max-h-60 overflow-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Code</TableHead><TableHead>Service</TableHead>
                    <TableHead>Category</TableHead><TableHead>Category UUID</TableHead>
                    <TableHead>Price</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {validRows.map(row => <TableRow key={row.index}>
                      <TableCell className="font-mono text-xs">{row.data.id || 'NEW'}</TableCell>
                      <TableCell>{row.data.service_code || '—'}</TableCell>
                      <TableCell>{row.data.name}</TableCell>
                      <TableCell>{row.data.category}</TableCell>
                      <TableCell className="font-mono text-xs">{row.data.category_id}</TableCell>
                      <TableCell>{row.data.base_price || '—'}</TableCell>
                      <TableCell>{row.data.is_active ? 'Active' : 'Inactive'}</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Invalid rows ({invalidRows.length}) — correct fields, then revalidate
                </h4>
                <div className="max-h-60 overflow-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>Code</TableHead><TableHead>Service</TableHead>
                      <TableHead>Category</TableHead><TableHead>Category UUID</TableHead>
                      <TableHead>Price</TableHead><TableHead>Errors</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {invalidRows.map(row => <TableRow key={row.index}>
                        <TableCell className="font-mono text-xs">{row.data.id || 'NEW'}</TableCell>
                        <TableCell><EditableCell row={row} field="service_code" /></TableCell>
                        <TableCell><EditableCell row={row} field="name" /></TableCell>
                        <TableCell><EditableCell row={row} field="category" /></TableCell>
                        <TableCell><EditableCell row={row} field="category_id" /></TableCell>
                        <TableCell><EditableCell row={row} field="base_price" type="number" /></TableCell>
                        <TableCell>
                          <ul className="list-disc list-inside text-xs text-red-500">
                            {row.errors.map((error, index) => <li key={index}>{error}</li>)}
                          </ul>
                        </TableCell>
                      </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Existing services must include their ID. Blank category UUIDs are resolved only by an exact category-name match.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={confirmImport}
            disabled={validRows.length === 0 || isImporting || isParsing || isRevalidating}
            className="bg-green-600 hover:bg-green-700">
            {isImporting ? 'Saving...' : 'Apply ' + updateRows + ' update(s) and ' + createRows + ' new service(s)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
