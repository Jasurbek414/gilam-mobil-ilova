const fs = require('fs');
// Fix orders_screen.dart Map::get syntax error
let c = fs.readFileSync('D:\\gilam\\mobil flutter\\lib\\screens\\orders_screen.dart', 'utf8');
c = c.replace(
  "  Map<String, dynamic>::get config => statusConfig[order['status']] ?? {'label': order['status'], 'emoji': '📦'};",
  ""
);
fs.writeFileSync('D:\\gilam\\mobil flutter\\lib\\screens\\orders_screen.dart', c, 'utf8');
console.log('Done orders fix');
