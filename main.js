const { Command } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();

//cтворення директорії для кешy якщо її нема
if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Директорію кеша створено: ${options.cache}`);
}

//ініціалізація експерса
const app = express();

//мідлвари для парсингу тіла запитіу
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//налаштування мультер для завантаження файлів
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, options.cache);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

//сховище для інвентаря в пам'яті
let inventory = [];
let currentId = 1;

//гет /RegisterForm.html для реєстр форми
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

//гет /SearchForm.html для пошук форми
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

//пост /register для реєстрації присторою
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;

  //перевірочка обов'яз поля
  if (!inventory_name || inventory_name.trim() === '') {
    return res.status(400).send('Bad Request: inventory_name is required');
  }

  //створення нью айтема
  const newItem = {
    id: currentId++,
    inventory_name: inventory_name.trim(),
    description: description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(newItem);

  res.status(201).json({
    message: 'Предмет інвентарю успішно зареєстровано',
    item: newItem
  });
});

//гет /inventory для отримання списку речей
app.get('/inventory', (req, res) => {
  const inventoryList = inventory.map(item => ({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  }));

  res.status(200).json(inventoryList);
});

//гет /inventory/id для конкретної речі
app.get('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  res.status(200).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  });
});

//пут /inventory/id для оновленні імені опису речі
app.put('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  const { inventory_name, description } = req.body;

  if (inventory_name !== undefined) {
    item.inventory_name = inventory_name;
  }
  if (description !== undefined) {
    item.description = description;
  }

  res.status(200).json({
    message: 'Інвентаризований предмет успішно оновлено',
    item: {
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    }
  });
});

//гет /inventory/ID/photo для отримання фото
app.get('/inventory/:id/photo', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item || !item.photo) {
    return res.status(404).send('Не знайдено');
  }

  const photoPath = path.join(options.cache, item.photo);

  if (!fs.existsSync(photoPath)) {
    return res.status(404).send('Не знайдено');
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(photoPath);
});

//пут /inventory/ID/photo для оновлення фото речі
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  //видалення старої фотки якщо вона є
  if (item.photo) {
    const oldPhotoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  //апдейт фото
  item.photo = req.file ? req.file.filename : null;

  res.status(200).json({
    message: 'Фото успішно оновлено',
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  });
});

//делете /inventory/ID для речі
app.delete('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const itemIndex = inventory.findIndex(i => i.id === itemId);

  if (itemIndex === -1) {
    return res.status(404).send('Не знайдено');
  }

  const item = inventory[itemIndex];

  //видалення фото при його наявності
  if (item.photo) {
    const photoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  //видалення елемента з інвентаря
  inventory.splice(itemIndex, 1);

  res.status(200).json({
    message: 'Інвентаризовну річ іспішно видалено'
  });
});

//пост /search обробка пошуку за айді
app.post('/search', (req, res) => {
  const itemId = parseInt(req.body.id);
  const hasPhoto = req.body.has_photo === 'on' || req.body.has_photo === 'true';

  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  let description = item.description;
  
  //додавання посилання на фото якщо обрано
  if (hasPhoto && item.photo) {
    const photoUrl = `http://${options.host}:${options.port}/inventory/${item.id}/photo`;
    description += `\n\nPhoto: ${photoUrl}`;
  }

  res.status(200).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: description,
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  });
});

//обробка неоголошених методів
app.use((req, res, next) => {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).send('Method not allowed');
  }
  next();
});

//запуск сервера
app.listen(options.port, options.host, () => {
  console.log(`Сервер працює на http://${options.host}:${options.port}/`);
  console.log(`Директорія кешу: ${options.cache}`);
});