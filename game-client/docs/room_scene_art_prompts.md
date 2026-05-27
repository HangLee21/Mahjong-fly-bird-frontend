# Room Scene 鎴块棿椤佃璁′笌缇庢湳璧勬簮 Prompt

鐩爣椤甸潰锛歚Room.scene` / `RoomSceneController`

椤甸潰瀹氫綅锛氱帺瀹惰繘鍏ユ寮忕墝灞€鍓嶇殑鎴块棿绛夊緟椤点€傝繖涓〉闈㈠紑濮嬪垏鎹负妯睆锛岃〃鐜颁负 4 鍚嶇帺瀹跺洿鐫€涓€寮犻夯灏嗘绛夊緟锛屾埧涓诲彲浠ユ坊鍔?AI銆佸紑濮嬫父鎴忥紝鏅€氱帺瀹跺彲浠ュ噯澶囥€?
## 鍔熻兘鑱岃矗

```text
1. 灞曠ず鎴块棿鍙凤紱
2. 灞曠ず 4 涓骇浣嶏紱
3. 鎴夸富娣诲姞 AI锛?4. 鐜╁鍑嗗锛?5. 鎴夸富寮€濮嬫父鎴忥紱
6. 鐩戝惉 ROOM_UPDATE锛?7. 娓告垙寮€濮嬪悗杩涘叆 Game Scene銆?```

## 妯睆绛栫暐

RoomEntry 鏄珫灞忓叆鍙ｉ〉锛孯oom 寮€濮嬭繘鍏ユí灞忋€?
寤鸿鍒嗕袱灞傚鐞嗭細

```text
绗竴灞傦細浠ｇ爜杩涘叆 Room.scene 鏃惰姹傛í灞忋€?绗簩灞傦細Cocos / 寰俊灏忔父鎴忔瀯寤洪厤缃厑璁告í灞忋€?```

浠ｇ爜灞傞潰鍙互鍦?`RoomSceneController.start()` 鏈€鍓嶉潰璋冪敤妯睆璇锋眰锛?
```ts
const wxApi = (globalThis as { wx?: { setDeviceOrientation?: (options: { value: string }) => void } }).wx;
wxApi?.setDeviceOrientation?.({ value: 'landscape' });
```

濡傛灉寰俊寮€鍙戣€呭伐鍏锋垨鐪熸満涓嶇敓鏁堬紝闇€瑕佹鏌ユ瀯寤洪厤缃€傚井淇″皬娓告垙鏈€缁堟槸鍚﹀厑璁歌繍琛屾椂妯珫灞忓垏鎹紝鍙栧喅浜庡井淇¤繍琛岀幆澧冨拰鏋勫缓閰嶇疆锛涘洜姝や唬鐮侀渶瑕佸仛鍏煎锛屼笉瑕佹妸瀹冨綋鎴愪竴瀹氭垚鍔熺殑鍚屾鎿嶄綔銆?
寤鸿妯睆璁捐鍒嗚鲸鐜囷細

```text
1334x750
```

涔熷彲浠ヤ娇鐢細

```text
1280x720
```

褰撳墠椤圭洰鐨?Runtime UI 搴旂户缁敤 `createLayout()`锛屼笉瑕佸啓姝诲浐瀹氬儚绱犮€傛墍鏈夊ぇ灏忕敤灞忓箷瀹介珮鐧惧垎姣旇绠椼€?
## 椤甸潰甯冨眬

```text
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 鎴块棿鍙峰窘绔?         瑙勫垯鎽樿/灞€鏁?           鈹?鈹?                                             鈹?鈹?                椤堕儴搴т綅                     鈹?鈹?                                             鈹?鈹?  宸︿晶搴т綅       涓ぎ楹诲皢妗?       鍙充晶搴т綅   鈹?鈹?                                             鈹?鈹?                鏈満搴т綅                     鈹?鈹?                                             鈹?鈹?       娣诲姞 AI / 鍑嗗 / 寮€濮嬫父鎴忔寜閽?         鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?```

瑙嗚閲嶇偣锛?
- 涓ぎ鏄竴寮犱刊瑙嗚楹诲皢妗岋紝鍗犲睆骞曞搴?48%-58%銆?- 4 涓骇浣嶅洿缁曢夯灏嗘锛氫笅鏂规槸鑷繁锛屽乏/鍙?涓婃槸鍏朵粬鐜╁銆?- 搴т綅瑕佹湁澶村儚妗嗐€佹樀绉板尯鍩熴€佸噯澶囩姸鎬佹爣璇嗐€?- 绌轰綅鏄剧ず鈥滅瓑寰呬腑鈥濇垨绌哄骇浣嶅浘锛屼笉鐩存帴鐢ㄦ枃瀛?Label锛屼紭鍏堢敤鍥剧墖銆?- 鎴夸富鐪嬪埌鈥滄坊鍔?AI鈥濆拰鈥滃紑濮嬫父鎴忊€濇寜閽€?- 鏅€氱帺瀹剁湅鍒扳€滃噯澶団€濇寜閽€?- 椤甸潰鏁翠綋搴斿拰 Lobby銆丷oomEntry 淇濇寔娣辩豢鑹层€侀噾杈广€佹洸闈栭灏忛浮楹诲皢姘涘洿銆?
## 寤鸿鑺傜偣缁撴瀯

```text
RoomRoot
鈹斺攢鈹€ RuntimeCanvas
    鈹溾攢鈹€ Background
    鈹溾攢鈹€ RoomCodeBadge
    鈹溾攢鈹€ RuleBadge
    鈹溾攢鈹€ MahjongTable
    鈹溾攢鈹€ SeatTop
    鈹溾攢鈹€ SeatRight
    鈹溾攢鈹€ SeatBottom
    鈹溾攢鈹€ SeatLeft
    鈹溾攢鈹€ ButtonAddAi
    鈹溾攢鈹€ ButtonReady
    鈹斺攢鈹€ ButtonStartGame
```

## 璧勬簮鏀剧疆璺緞

鍘熷璧勬簮鏀捐繖閲岋細

```text
game-client/assets/textures/ui/
```

鍔ㄦ€佸姞杞借祫婧愬悓姝ユ斁杩欓噷锛?
```text
game-client/assets/resources/textures/ui/
```

浠ｇ爜鍔犺浇鏃惰矾寰勪笉瑕佸甫鎵╁睍鍚嶏細

```text
textures/ui/room_waiting_bg
textures/ui/room_table
textures/ui/room_code_badge
textures/ui/room_rule_badge
textures/ui/seat_frame_self
textures/ui/seat_frame_other
textures/ui/seat_frame_empty
textures/ui/status_ready
textures/ui/status_waiting
textures/ui/button_add_ai
textures/ui/button_ready
textures/ui/button_start_game
```

## 璧勬簮娓呭崟

## 图片中文字策略

按钮、状态牌、标题类资源的文字直接画在 PNG 里，不依赖后期 Label 叠字。代码里的文字只作为缺图时的临时占位。

```text
需要自带文字：button_add_ai、button_ready、button_start_game、button_settings、button_confirm、status_ready、status_waiting
不自带文字：背景、桌子、座位框、头像框、房间号徽章、规则徽章、设置弹窗底图
```

设置弹窗里的局数和规则选项，如果要做到完全不叠字，建议后续额外生成每个选项的独立按钮图，例如：

```text
button_round_8_on.png / button_round_8_off.png
button_round_16_on.png / button_round_16_off.png
button_round_24_on.png / button_round_24_off.png
button_round_32_on.png / button_round_32_off.png
button_chow_on.png / button_chow_off.png
button_multi_win_on.png / button_multi_win_off.png
button_fan_cap_3_on.png / button_fan_cap_3_off.png
button_fan_cap_4_on.png / button_fan_cap_4_off.png
button_public_kong_2_on.png / button_public_kong_2_off.png
button_public_kong_4_on.png / button_public_kong_4_off.png
```

| 鏂囦欢鍚?| 鐢ㄩ€?| 寤鸿灏哄 | 鏍煎紡 | 浼樺厛绾?|
| --- | --- | --- | --- | --- |
| `room_waiting_bg.png` | 妯睆鎴块棿鑳屾櫙 | `1334x750` | PNG/JPG | 楂?|
| `room_table.png` | 涓ぎ楹诲皢妗屼刊瑙嗗浘 | `760x460` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `room_code_badge.png` | 鎴块棿鍙峰窘绔犲簳鍥?| `320x96` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `room_rule_badge.png` | 瑙勫垯鎽樿搴曞浘 | `520x86` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `seat_frame_self.png` | 鏈満鐜╁搴т綅妗?| `260x138` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `seat_frame_other.png` | 鍏朵粬鐜╁搴т綅妗?| `230x126` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `seat_frame_empty.png` | 绌哄骇浣嶆 | `230x126` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `avatar_placeholder.png` | 榛樿澶村儚 | `96x96` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `status_ready.png` | 宸插噯澶囩姸鎬佺墝 | `150x58` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `status_waiting.png` | 绛夊緟涓姸鎬佺墝 | `150x58` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `button_add_ai.png` | 娣诲姞 AI 鎸夐挳 | `260x86` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `button_ready.png` | 鍑嗗鎸夐挳 | `260x86` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `button_start_game.png` | 寮€濮嬫父鎴忔寜閽?| `300x96` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `button_settings.png` | 璁剧疆鎸夐挳 | `150x66` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `room_settings_dialog.png` | 璁剧疆寮圭獥搴曞浘 | `640x520` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `button_confirm.png` | 寮圭獥纭畾鎸夐挳 | `240x80` | PNG 閫忔槑鑳屾櫙 | 楂?|
| `button_option_on.png` | 璁剧疆椤归€変腑鎸夐挳搴曞浘 | `180x72` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `button_option_off.png` | 璁剧疆椤规湭閫夋寜閽簳鍥?| `180x72` | PNG 閫忔槑鑳屾櫙 | 涓?|
| `button_back_room.png` | 杩斿洖鎸夐挳 | `86x86` | PNG 閫忔槑鑳屾櫙 | 浣?|

## Prompt锛歳oom_waiting_bg.png

```text
Create a landscape mobile game background for a Chinese mahjong room waiting scene, 1334x750, dark emerald green felt and subtle Yunnan mountain pattern, elegant gold ornamental corners, faint mahjong tile decorations around edges, clean central area for a mahjong table, premium casual board game style, no text, no logo, no buttons, no people, no watermark
```

璐熼潰璇嶏細

```text
text, logo, watermark, people, casino photo, cluttered center, purple neon, low resolution, cropped objects
```

## Prompt锛歳oom_table.png

```text
Create a transparent PNG empty top-down mahjong table for a Chinese mobile game room waiting screen, 760x460, rounded square green felt tabletop, warm gold trim, four player sides clearly implied by the table shape only, clean empty central felt area, premium casual mahjong UI style, transparent background, no text, no players, no mahjong tiles, no tile walls, no tile rails, no cards, no dice, no chips, no objects on the table
```

璐熼潰璇嶏細

```text
background, text, logo, people, photorealistic casino, mahjong tiles, tile wall, tile rail, cards, dice, chips, objects on table, perspective distortion, watermark
```

## Prompt锛歳oom_code_badge.png

```text
Create a transparent PNG room code badge for a Chinese mahjong mobile game, 320x96, jade green plaque with warm gold border, small mahjong tile ornament, space for six digit room number in the center, premium polished UI, transparent background, no built-in numbers, no text
```

## Prompt锛歳oom_rule_badge.png

```text
Create a transparent PNG rule summary badge for a Chinese mahjong mobile game, 520x86, long jade green rounded plaque, warm gold border, subtle carved pattern, suitable for placing short rule text on top, transparent background, no text, no numbers
```

## Prompt锛歴eat_frame_self.png

```text
Create a transparent PNG player seat frame for the local player in a Chinese mahjong mobile game, 260x138, jade green and warm gold frame, circular avatar slot on the left, nickname plaque area, small ready status slot, slightly brighter highlight than other seats, premium casual board game UI, transparent background, no text, no avatar
```

## Prompt锛歴eat_frame_other.png

```text
Create a transparent PNG player seat frame for other players in a Chinese mahjong mobile game, 230x126, jade green and warm gold frame, circular avatar slot, nickname plaque area, small ready status slot, premium casual board game UI, transparent background, no text, no avatar
```

## Prompt锛歴eat_frame_empty.png

```text
Create a transparent PNG empty player seat frame for a Chinese mahjong mobile game, 230x126, darker jade green frame with warm gold border, empty circular avatar placeholder, subtle waiting glow, premium casual board game UI, transparent background, no text, no avatar
```

## Prompt锛歛vatar_placeholder.png

```text
Create a transparent PNG default avatar icon for a Chinese mahjong mobile game, 96x96, round jade and gold avatar placeholder, simple mahjong tile motif, no face, no text, premium casual board game style, transparent background
```

## Prompt：status_ready.png

```text
Create a transparent PNG status badge for a Chinese mahjong mobile game. The badge text MUST be baked directly into the image, centered and fully readable. Baked text reads "已准备", 150x58, jade green base with gold border, ivory readable Chinese characters, polished mobile game UI, transparent background
```

## Prompt：status_waiting.png

```text
Create a transparent PNG status badge for a Chinese mahjong mobile game. The badge text MUST be baked directly into the image, centered and fully readable. Baked text reads "等待中", 150x58, dark jade green base with gold border, ivory readable Chinese characters, polished mobile game UI, transparent background
```

## Prompt：button_add_ai.png

```text
Create a transparent PNG game UI button for a Chinese mahjong mobile game. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "添加AI", 260x86, emerald green base, warm gold border, polished beveled style, readable ivory Chinese characters centered, transparent background
```

## Prompt锛歜utton_ready.png

```text
Create a transparent PNG game UI button for a Chinese mahjong mobile game. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "准备", 260x86, emerald green base, warm gold border, polished beveled style, readable ivory Chinese characters centered, transparent background
```

## Prompt锛歜utton_start_game.png

```text
Create a transparent PNG primary game UI button for a Chinese mahjong mobile game. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "开始游戏", 300x96, brighter emerald green base, warm gold border, polished beveled style, readable ivory Chinese characters centered, slightly stronger glow than normal buttons, transparent background
```

## Prompt锛歜utton_settings.png

```text
Create a transparent PNG settings button for a Chinese mahjong mobile game. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "设置", 150x66, compact emerald green button, warm gold border, polished beveled style, readable ivory Chinese characters centered, transparent background
```

## Prompt锛歳oom_settings_dialog.png

```text
Create a transparent PNG settings dialog panel for a landscape Chinese mahjong mobile game, 640x520, dark jade green lacquer panel, warm gold ornate border, subtle inner panels for options, premium casual board game UI, transparent background, no text, no buttons baked in
```

## Prompt锛歜utton_confirm.png

```text
Create a transparent PNG confirmation button for a Chinese mahjong mobile game settings dialog. The button text MUST be baked directly into the image, centered and fully readable. Baked text reads "确定", 240x80, emerald green base, warm gold border, polished beveled style, readable ivory Chinese characters centered, transparent background
```

## Prompt锛歜utton_option_on.png

```text
Create a transparent PNG selected option button for a Chinese mahjong mobile game settings dialog, 180x72, bright jade green base, warm gold border, subtle glow, transparent background, no text, used only as a fallback background if per-option baked-text buttons are not available
```

## Prompt锛歜utton_option_off.png

```text
Create a transparent PNG unselected option button for a Chinese mahjong mobile game settings dialog, 180x72, dark jade green base, muted gold border, no glow, transparent background, no text, used only as a fallback background if per-option baked-text buttons are not available
```

## Prompt锛歜utton_back_room.png

```text
Create a transparent PNG circular back button for a Chinese mahjong mobile game, 86x86, jade green circular button with warm gold rim, ivory left arrow icon centered, polished mobile game UI, transparent background, no text
```

## Cocos 鍦烘櫙鎼缓寤鸿

`Room.scene` 閲屽彧闇€瑕佷竴涓牴鑺傜偣锛?
```text
Room
鈹斺攢鈹€ RoomRoot
```

鍦?`RoomRoot` 涓婃寕杞斤細

```text
RoomSceneController.ts
```

鍏朵粬 UI 鍙互缁х画鐢变唬鐮佽繍琛屾椂鍒涘缓锛屼笉寮轰緷璧栨墜鍔ㄦ嫋鑺傜偣銆?
寤鸿 `RoomSceneController` 鍚庣画鎸夎繖涓『搴忓垱寤猴細

```text
1. 璇锋眰妯睆锛?2. ensureCanvas锛?3. 鍒涘缓妯睆鑳屾櫙锛?4. 鍒涘缓鎴块棿鍙峰窘绔狅紱
5. 鍒涘缓瑙勫垯鎽樿寰界珷锛?6. 鍒涘缓涓ぎ楹诲皢妗岋紱
7. 鎸夊骇浣嶇姸鎬佸垱寤?4 涓?Seat锛?8. 鏍规嵁鏄惁鎴夸富鏄剧ず 娣诲姞AI / 寮€濮嬫父鎴忥紱
9. 鏍规嵁鏄惁鏅€氱帺瀹舵樉绀?鍑嗗锛?10. 鐩戝惉 ROOM_UPDATE 鍚庡埛鏂板骇浣嶏紱
11. 鏀跺埌娓告垙寮€濮嬪悗 loadScene('Game')銆?```

## 鎺ㄨ崘妯睆鍧愭爣姣斾緥

鍩轰簬 `createLayout()`锛?
```text
Background: width 100%, height 100%, pos(0, 0)
RoomCodeBadge: width 24%, pos(-36, 42)
RuleBadge: width 42%, pos(10, 42)
MahjongTable: width 56%, pos(0, 0)
SeatTop: width 18%, pos(0, 31)
SeatRight: width 17%, pos(38, 0)
SeatBottom: width 21%, pos(0, -32)
SeatLeft: width 17%, pos(-38, 0)
ButtonAddAi: width 18%, pos(-18, -43)
ButtonReady: width 18%, pos(0, -43)
ButtonStartGame: width 21%, pos(20, -43)
SettingsButton: width 10%, pos(42, 42)
SettingsDialog: width 48%, height 74%, pos(0, 0)
```

杩欓噷鐨?`pos(x, y)` 鎸?`layout.pos(xPercent, yPercent)`锛屼笉鏄浐瀹氬儚绱犮€?
## 浠ｇ爜璧勬簮璺緞棰勭暀

```text
textures/ui/room_waiting_bg
textures/ui/room_table
textures/ui/room_code_badge
textures/ui/room_rule_badge
textures/ui/seat_frame_self
textures/ui/seat_frame_other
textures/ui/seat_frame_empty
textures/ui/avatar_placeholder
textures/ui/status_ready
textures/ui/status_waiting
textures/ui/button_add_ai
textures/ui/button_ready
textures/ui/button_start_game
textures/ui/button_settings
textures/ui/room_settings_dialog
textures/ui/button_confirm
textures/ui/button_option_on
textures/ui/button_option_off
textures/ui/button_back_room
```

## 璁剧疆寮圭獥鍐呭

榛樿璁剧疆锛?
```text
灞€鏁帮細16杞?鍚冪墝锛氬紑鍚?涓€鐐鍝嶏細寮€鍚?灏侀《鐣暟锛?鐣?鍏紑鏉犵墝锛?寮?```

灞€鏁伴€夐」锛?
```text
8杞?/ 16杞?/ 24杞?/ 32杞?```

绗竴鐗堝彧鍦ㄥ墠绔?Room Scene 鍐呬繚瀛樿缃紝鐢ㄤ簬 UI 灞曠ず鍜屽悗缁垱寤烘埧闂村弬鏁板鎺ャ€傜瓑鍚庣鎺ュ彛鏀寔鍚庯紝鍐嶆妸杩欎簺璁剧疆鏀捐繘 `createRoom` 璇锋眰浣擄細

```ts
{
  roundCount: 16,
  allowChow: true,
  allowMultiWin: true,
  fanCap: 3,
  publicKongTiles: 2
}
```




