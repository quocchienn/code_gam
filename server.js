require('dotenv').config();
var cors = require('cors');
let Telegram      = require('node-telegram-bot-api');
let TelegramToken = process.env.TELEGRAM_TOKEN || '5180271425:AAFGUtqkl4_laRpVksB4YTCswsx63sLBDew';
let TelegramBot   = new Telegram(TelegramToken, {polling: true});
let fs            = require('fs');
let express       = require('express');
let app           = express();

app.use(cors({
    origin: '*',
    optionsSuccessStatus: 200
}));

let port       = process.env.PORT || 80;
let expressWs  = require('express-ws')(app);
let bodyParser = require('body-parser');
var morgan = require('morgan');

// Setting & Connect to the Database
let configDB = require('./config/database');
let mongoose = require('mongoose');
require('mongoose-long')(mongoose); // INT 64bit

mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex',   true);

// Kết nối MongoDB với timeout và catch error
mongoose.connect(configDB.url, {
    ...configDB.options,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connect error:', err.message));

// cấu hình tài khoản admin mặc định và các dữ liệu mặc định
require('./config/admin');

// đọc dữ liệu from
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(morgan('combined'));

app.set('view engine', 'ejs'); // chỉ định view engine là ejs
app.set('views', './views');   // chỉ định thư mục view

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static('public'));

// Health check route cho Render
app.get('/', (req, res) => res.send('OK'));

// server socket
let redT = expressWs.getWss();
process.redT = redT;
redT.telegram = TelegramBot;
global['redT'] = redT;
global['userOnline'] = 0;
require('./app/Helpers/socketUser')(redT); // Add function socket
require('./routerHttp')(app, redT);        // load các routes HTTP
require('./routerCMS')(app, redT);         // load routes CMS
require('./routerSocket')(app, redT);      // load các routes WebSocket

// === TÀI XỈU: dùng export object, KHÔNG gọi như hàm ===
const TaiXiu = require('./app/Cron/taixiu');
TaiXiu.ensureHUDefault();
TaiXiu.playGame(redT);

// Bầu cua vẫn giữ kiểu cũ nếu file đó export là function
require('./app/Cron/baucua')(redT);

require('./config/Cron')();

// Chỉ khởi tạo bot nếu có token (tránh 409 khi test)
// hoặc bạn để nguyên, nhưng đảm bảo chỉ 1 nơi chạy polling
if (process.env.TELEGRAM_TOKEN) {
  require('./app/Telegram/Telegram')(redT);  // Telegram Bot
}


app.listen(port, function() {
    console.log("Server listen on port", port);
});
