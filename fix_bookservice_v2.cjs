const fs = require('fs');
const path = 'src/pages/admin/AdminBookService.tsx';
let content = fs.readFileSync(path, 'utf8');
const hadCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

let changes = 0;

const oldTable = `            <div className="overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{item.code}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateQuantity(item.id, Number(e.target.value) || 1)} className="w-14 h-7 text-center mx-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" value={item.discount} onChange={e => updateDiscount(item.id, Number(e.target.value) || 0)} className="w-20 h-7 text-right ml-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-7 w-7"><X className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>`;

const newTable = `            {/* Mobile card view - shown only on small screens */}
            <div className="sm:hidden space-y-3">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="font-mono text-[10px] mb-1">{item.code}</Badge>
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-8 w-8 shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Quantity</label>
                      <Input type="number" min="1" value={item.quantity} onChange={e => updateQuantity(item.id, Number(e.target.value) || 1)} className="h-10 text-base text-center" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Discount (Ksh)</label>
                      <Input type="number" min="0" value={item.discount} onChange={e => updateDiscount(item.id, Number(e.target.value) || 0)} className="h-10 text-base text-right" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{item.price.toLocaleString()}</span> × {item.quantity}
                    </div>
                    <span className="font-bold text-sm text-primary font-mono">{item.total.toLocaleString()} Ksh</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view - hidden on small screens */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{item.code}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateQuantity(item.id, Number(e.target.value) || 1)} className="w-14 h-7 text-center mx-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" value={item.discount} onChange={e => updateDiscount(item.id, Number(e.target.value) || 0)} className="w-20 h-7 text-right ml-auto text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-7 w-7"><X className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>`;

if (content.includes(oldTable)) {
  content = content.replace(oldTable, newTable);
  changes++;
  console.log('Fix 3 applied: mobile card view for line items');
} else {
  console.log('WARN Fix 3 not found - check whitespace/content');
}

console.log(`Total changes: ${changes}`);
if (hadCRLF) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(path, content);
console.log('Done.');
