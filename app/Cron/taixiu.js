'use strict';

let TXCuoc    = require('../../Models/TaiXiu_cuoc');
let TaiXiu_phien = require('../../Models/TaiXiu_phien');
let HU_game   = require('../../Models/HU');
let HUTX      = require('../../Models/HUTX');
let UserInfo  = require('../../Models/UserInfo');
let Helpers   = require('../../Helpers/Helpers');

// --- Bọc lỗi toàn cục để không chết process ---
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

/**
 * Đảm bảo có HU mặc định, tránh null
 */
async function ensureHUDefault() {
  try {
    const doc = await HU_game.findOne({ game: 'taixiumd5', type: 1 }).lean();
    if (!doc) {
      await HU_game.create({ game: 'taixiumd5', type: 1, hutx: 0 });
      console.log('[ensureHUDefault] Created default HU for taixiumd5');
    }
  } catch (e) {
    console.error('[ensureHUDefault]', e && e.message ? e.message : e);
  }
}

/**
 * Thông tin thanh toán phiên
 */
let thongtin_thanhtoan = function (game_id, dice = false) {
  if (dice) {
    HU_game.findOne({ game: 'taixiumd5', type: 1 }, 'hutx', function (err, data) {
      if (err) { console.error('[HU_game findOne]', err.message); }
      const hutaix = (data && typeof data.hutx !== 'undefined') ? Number(data.hutx) : 0;

      HUTX.findOne({}, 'phiennohu', { sort: { 'phiennohu': -1 } }, function (err2, last) {
        if (err2) { console.error('[HUTX findOne]', err2.message); }
        const getphiennohu = (last && typeof last.phiennohu !== 'undefined')
          ? (Number(last.phiennohu) + 1)
          : 1;

        let TaiXiu_red_tong_tai = 0;
        let TaiXiu_red_tong_xiu = 0;
        let TaiXiu_tonguser_tai = 0;
        let TaiXiu_tonguser_xiu = 0;
        let user_select_tai = 0;
        let user_select_xiu = 0;
        let red_player_tai = 0;
        let red_player_xiu = 0;
        let getphien = 0;

        let vipConfig = Helpers.getConfig('topVip');

        TXCuoc.find({ phien: game_id }, null, { sort: { '_id': -1 } }, function (err3, list) {
          if (err3) { console.error('[TXCuoc find]', err3.message); list = []; }

          // TODO: ở đây giữ nguyên toàn bộ xử lý tính tổng cược của bạn

          try {
            const payload = {
              hutaix,
              getphiennohu,
              TaiXiu_red_tong_tai,
              TaiXiu_red_tong_xiu,
              TaiXiu_tonguser_tai,
              TaiXiu_tonguser_xiu,
              user_select_tai,
              user_select_xiu,
              red_player_tai,
              red_player_xiu,
              getphien,
            };
            // gửi payload về socket client
            // redT.clients.forEach(ws => ws.send(JSON.stringify(payload)));
          } catch (e) {
            console.error('[thongtin_thanhtoan payload]', e && e.message ? e.message : e);
          }
        });
      });
    });
  }
};

/**
 * Hàm playGame – chỗ lấy datahu.hutx sửa null-safe
 */
function playGame(io) {
  HU_game.findOne({ game: 'taixiumd5', type: 1 }, 'hutx', function (err, datahu) {
    if (err) { console.error('[HU_game findOne in playGame]', err.message); }
    const tienhu = (datahu && typeof datahu.hutx !== 'undefined') ? Number(datahu.hutx) : 0;

    let home = { hutxmain: { monney: tienhu } };

    Object.values(io.users).forEach(function (users) {
      users.forEach(function (client) {
        if (client.gameEvent !== void 0 && client.gameEvent.viewTaiXiu !== void 0 && client.gameEvent.viewTaiXiu) {
          client.red(home);
        } else if (client.scene == 'home') {
          client.red(home);
        }
      });
    });
  });

  HU_game.findOne({ game: 'taixiumd5', type: 1 }, 'hutx', function (err, datahu) {
    if (err) { console.error('[HU_game findOne in playGame #2]', err.message); }
    const tienhu = (datahu && typeof datahu.hutx !== 'undefined') ? Number(datahu.hutx) : 0;

    let home = { taixiu: { hutx: { monney: tienhu } } };

    Object.values(io.users).forEach(function (users) {
      users.forEach(function (client) {
        if (client.gameEvent !== void 0 && client.gameEvent.viewTaiXiu !== void 0 && client.gameEvent.viewTaiXiu) {
          client.red(home);
        } else if (client.scene == 'home') {
          client.red(home);
        }
      });
    });
  });
}

// --- Export (tùy cách bạn require file này) ---
module.exports = {
  thongtin_thanhtoan,
  playGame,
  ensureHUDefault,
};
