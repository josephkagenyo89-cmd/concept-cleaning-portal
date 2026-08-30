const fs = require('fs');
const path = 'src/pages/admin/AdminBookService.tsx';
let content = fs.readFileSync(path, 'utf8');
const hadCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

let changes = 0;

// Fix 1: Service picker dropdown - taller and properly scrollable on touch
const old1 = 'className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-10 max-h-48 overflow-y-auto"';
const new1 = 'className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-10 max-h-64 overflow-y-auto overscroll-contain"';
if (content.includes(old1)) { content = content.replace(old1, new1); changes++; console.log('Fix 1 applied: service picker scroll'); }
else console.log('WARN Fix 1 not found');

// Fix 2: Hide Description and Unit table headers on mobile
const old2 = '<TableHead>Description</TableHead>';
const new2 = '<TableHead className="hidden sm:table-cell">Description</TableHead>';
if (content.includes(old2)) { content = content.replace(new RegExp(old2, 'g'), new2); changes++; console.log('Fix 2 applied: hide Description col on mobile'); }
else console.log('WARN Fix 2 not found');

// Fix 3: Replace the services section with mobile-friendly version
// Find the services card section and replace it with one that has both table (desktop) and cards (mobile)
const oldServicesSection = `          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="w-16">Qty</TableHead>
                  <TableHead className="w-16">Unit</TableHead>
                  <TableHead className="w-24">Unit Price (KES)</TableHead>
                  <TableHead className="w-20">Discount</TableHead>
                  <TableHead className="w-24">Subtotal</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.service_name}</div>
                      <div className="text-xs text-muted-foreground">{item.unit}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input
                        value={item.description}
                        onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                        className="h-8 text-xs w-full min-w-[120px]"
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                        className="h-8 text-xs w-16"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={e => updateLineItem(item.id, 'unit_price', Number(e.target.value))}
                        className="h-8 text-xs w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_pct}
                        onChange={e => updateLineItem(item.id, 'discount_pct', Number(e.target.value))}
                        className="h-8 text-xs w-16"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {formatKes(item.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>`;

const newServicesSection = `          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {lineItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <p className="font-semibold text-sm leading-tight">{item.service_name}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(item.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Qty</label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Price (Ksh)</label>
                    <Input
                      type="number"
                      min="0"
                      value={item.unit_price}
                      onChange={e => updateLineItem(item.id, 'unit_price', Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Disc %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount_pct}
                      onChange={e => updateLineItem(item.id, 'discount_pct', Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-sm text-market">{formatKes(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-16">Qty</TableHead>
                  <TableHead className="w-16">Unit</TableHead>
                  <TableHead className="w-24">Unit Price (KES)</TableHead>
                  <TableHead className="w-20">Discount</TableHead>
                  <TableHead className="w-24">Subtotal</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.service_name}</div>
                      <div className="text-xs text-muted-foreground">{item.unit}</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                        className="h-8 text-xs w-full min-w-[120px]"
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                        className="h-8 text-xs w-16"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={e => updateLineItem(item.id, 'unit_price', Number(e.target.value))}
                        className="h-8 text-xs w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_pct}
                        onChange={e => updateLineItem(item.id, 'discount_pct', Number(e.target.value))}
                        className="h-8 text-xs w-16"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {formatKes(item.subtotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>`;

if (content.includes(oldServicesSection)) {
  content = content.replace(oldServicesSection, newServicesSection);
  changes++;
  console.log('Fix 3 applied: mobile card view for line items');
} else {
  console.log('WARN Fix 3 not found - table section mismatch');
}

console.log(`\nTotal changes: ${changes}`);
if (hadCRLF) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(path, content);
console.log('Done.');
