const fs = require('fs');
let c = fs.readFileSync('D:\\gilam\\mobil flutter\\lib\\screens\\profile_screen.dart', 'utf8');
const old = `    _commentCtrl.text = rawComment.replaceFirst(RegExp(r'^(Kirim|Xarajat): Haydovchi mobil ilovasidan qo\\'shildi\\.\\s*'), '');`;
const newStr = `    _commentCtrl.text = rawComment.replaceFirst(RegExp(r"^(Kirim|Xarajat): Haydovchi mobil ilovasidan qo'shildi\\.\\s*"), '');`;
c = c.replace(old, newStr);
fs.writeFileSync('D:\\gilam\\mobil flutter\\lib\\screens\\profile_screen.dart', c, 'utf8');
console.log('Done');
