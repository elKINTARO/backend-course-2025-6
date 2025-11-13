const { Command } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();

//створення директорії кешу якщо її нема
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Директорію кеша створено: ${options.cache}`);
}
//кріейт
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Сервіс інвентаризації працює');
});
//запуск
server.listen(options.port, options.host, () => {
  console.log(`Сервер працює на http://${options.host}:${options.port}/`);
  console.log(`Директорія кешу: ${options.cache}`);
});