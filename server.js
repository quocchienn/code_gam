require('dotenv').config();

const cors = require('cors');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const Telegram = require('node-telegram-bot-api');
const TelegramToken = process.env.TELEGRAM_TOKEN || 'YOUR_TOKEN_HERE'; // có thể giữ hardcode nếu bạn muốn
const TelegramBot = new Telegram(TelegramToken, { polling: true });

const bodyParser = require('body-parser');
const morgan = require('morgan');
const expressWs = require('express-ws')(app);

const session = require('express-session');
const MongoStore = require('connect-mongo');

// ====== DB ======
const configDB = require('./config/database');
const mongoose = require('mongoose');
require('mongoose-long')(mongoose);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

// Kết nối Mongo (có timeout, log rõ ràng)
mongoose.connect(configDB.url, {
  ...configDB.options,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connect error:', err && err.message ? err.message : err);
});

// ====== App base middlewares ======
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('combined'));

app.set('view engine', 'ejs');
app.set('views', './views');

// Serve static public
app.use(express.static('public'));

// Health check cho Render
app.get('/', (req, res) => res.send('OK'));

// ====== Session (bắt buộc để login admin giữ trạng thái) ======
app.set('trust proxy', 1); // cần khi chạy sau proxy (HTTPS Render)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: configDB.url }),
  cookie: {
    secure: true,      // HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 // 1 giờ
  }
}));

// Nếu có giao diện admin tĩnh, mở đường dẫn /admin
// (Không bắt buộc. Bỏ nếu bạn dùng CMS qua router)
if (fs.existsSync(path.join(__dirname, 'ADMIN'))) {
  app.use('/admin', express.static('ADMIN'));
  app.get('/admin/*', (req, res) =>
    res.sendFile(path.join(__dirname, 'ADMIN', 'index.html'))
  );
}

// ====== Socket hub ======
const redT = expressWs.getWss();
process.redT = redT;
redT.telegram = TelegramBot;
global['redT'] = redT;
global['userOnline'] = 0;

// ====== Admin & dữ liệu mặc định ======
require('./config/admin'); // tạo admin mặc định nếu thiếu

// ====== Routers ======
require('./app/Helpers/socketUser')(redT); // socket helpers
require('./routerHttp')(app, redT);        // HTTP routes
require('./routerCMS')(app, redT);         // CMS routes (đăng nhập /api/vl/login ...)
require('./routerSocket')(app, redT);      // WebSocket routes

// ====== Game Cron ======
// Tài Xỉu (export object: ensureHUDefault + playGame)
const TaiXiu = require('./app/Cron/taixiu');
if (TaiXiu && typeof TaiXiu.ensureHUDefault === 'function') {
  TaiXiu.ensureHUDefault();
}
if (TaiXiu && typeof TaiXiu.playGame === 'function') {
  TaiXiu.playGame(redT);
}

// Bầu Cua (giữ nguyên nếu file này export là function)
require('./app/Cron/baucua')(redT);

// Cron tổng (lưu ý viết hoa đúng tên file: Cron.js)
require('./config/Cron')();

// Telegram Bot – nếu muốn tắt khi test, comment dòng dưới
require('./app/Telegram/Telegram')(redT);

// ====== Start server ======
const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log('Server listen on port', port);
});

// ====== “Áo phao” chống crash khi đang debug ======
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
