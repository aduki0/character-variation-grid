// ★追加：チェックボックスの要素を取得
const toggleCharacterName = document.getElementById("toggleCharacterName");

// 重複していた宣言を1つに整理
const characterName = document.getElementById("characterName");

const backgroundColor =
    document.getElementById(
        "backgroundColor"
    );

const textColor =
    document.getElementById(
        "textColor"
    );

const fontSizeInput =
    document.getElementById(
        "fontSize"
    );

const fontFamilyInput =
    document.getElementById(
        "fontFamily"
    );

const cellBackgroundColor =
    document.getElementById(
        "cellBackgroundColor"
    );

const MAX_DISPLAY_HEIGHT = 800;

// ==========================================
// ★ここに「デフォルト値の設定」を追記します
// ==========================================

// 全体の背景色
backgroundColor.value = "#a9a9a9";

// 文字の色
textColor.value = "#ffffff";

// アイコンの背景色
cellBackgroundColor.value = "#ffffff";

// 文字のサイズ
fontSizeInput.value = "22";

// キャラ名の初期値（空っぽにしておきたい場合は不要です）
//characterName.value = "キャラの名前";

let draggedPreviewIndex = null;
let displayScale = 1;


const previewGrid =
    document.getElementById(
        "previewGrid"
    );

let displayItems = [];

const columnInput =
    document.getElementById("columnInput");

const gapInput =
    document.getElementById("gapInput");

// ★修正：縦と横、それぞれの入力欄を取得する
const outerGapYInput =
    document.getElementById("outerGapYInput");
const outerGapXInput =
    document.getElementById("outerGapXInput");

    // ★追加：角丸入力欄を取得
const borderRadiusInput =
    document.getElementById("borderRadiusInput");

    // ★追加：サイズ入力欄を取得
const cellSizeInput = document.getElementById("cellSizeInput");

    // ★追加：ファイル名入力欄を取得
const fileNameInput =
    document.getElementById("fileNameInput");

const saveButton =
    document.getElementById("saveButton");

let generatedCanvas = null;

const generateButton =
    document.getElementById("generateButton");

const resultContainer =
    document.getElementById("resultContainer");

const folderInput = document.getElementById("folderInput");
const status = document.getElementById("status");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let imageFiles = [];
let image = new Image();

const workspace = document.getElementById("workspace");

// サムネ一覧を表示するために確保したい最低限の幅（px）
const PREVIEW_MIN_WIDTH = 300;

// キャンバス（立ち絵プレビュー）が大きすぎて横並びにすると
// 窮屈になる場合は、縦並びレイアウトに自動で切り替える
function updateWorkspaceLayout() {
    if (!workspace || !canvas.width) return;

    const availableWidth = workspace.clientWidth;
    const needsStack =
        (canvas.width + PREVIEW_MIN_WIDTH) > availableWidth;

    workspace.classList.toggle("stacked", needsStack);
}

window.addEventListener("resize", updateWorkspaceLayout);

let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

let isDragging = false;

let cropRect = null;



folderInput.addEventListener("change", (event) => {

    imageFiles = [...event.target.files]
        .filter(file => {
            // 1. 画像ファイル以外を除外
            if (!file.type.startsWith("image/")) return false;
            
            // 2. ★追加：サブフォルダ内のファイルを除外する
            // webkitRelativePath（例: "キャラフォルダ/ポーズ1/shoujo.png"）に
            // スラッシュが2つ以上入っている（＝サブフォルダ内にある）場合は不採用にする
            const slashCount = (file.webkitRelativePath.match(/\//g) || []).length;
            return slashCount === 1; 
        });
        displayItems =
    imageFiles.map(file => ({
        file,
        thumbnail: null,
                enabled: true,  //★チェックボックス追加修正
        label: file.name.replace(
            /\.[^/.]+$/,
            ""
        )
    }));

    if (displayItems.length === 0) {
        return;
    }

    status.textContent =
        `${displayItems.length}枚の画像を読み込みました`;

    const firstImage = imageFiles[0];

    image.onload = () => {

        displayScale = 1;

        if (image.height > MAX_DISPLAY_HEIGHT) {
            displayScale =
                MAX_DISPLAY_HEIGHT / image.height;
        }

        canvas.width =
            image.width * displayScale;

        canvas.height =
            image.height * displayScale;

        drawCanvas();
        updateWorkspaceLayout();
    };
    image.src = URL.createObjectURL(firstImage);

});

function drawCanvas() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (cropRect) {

        const centerX =
            cropRect.displayX + cropRect.displayWidth / 2;
        const centerY =
            cropRect.displayY + cropRect.displayHeight / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(cropRect.rotation || 0);

        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;

        ctx.strokeRect(
            -cropRect.displayWidth / 2,
            -cropRect.displayHeight / 2,
            cropRect.displayWidth,
            cropRect.displayHeight
        );

        ctx.restore();

        drawResizeHandle();
        drawRotateHandle();
    }
}

// マウス座標(screen)を、cropRectの「回転していない状態」のローカル座標
// （中心を原点とした座標）に変換するヘルパー
function toLocalUnrotated(mouseX, mouseY) {
    const centerX =
        cropRect.displayX + cropRect.displayWidth / 2;
    const centerY =
        cropRect.displayY + cropRect.displayHeight / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;

    const rotation = cropRect.rotation || 0;

    // 順回転(rotate)の逆変換（転置行列）
    return {
        x: dx * Math.cos(rotation) + dy * Math.sin(rotation),
        y: -dx * Math.sin(rotation) + dy * Math.cos(rotation),
        centerX,
        centerY
    };
}

// 移動・リサイズ用の変数
let isMoving = false;
let isResizing = false;
let moveStartX = 0;
let moveStartY = 0;

// リサイズ時に固定する基準点（回転後の左上角のスクリーン座標）
let resizeAnchorX = 0;
let resizeAnchorY = 0;
let resizeRotation = 0;

// 回転用の変数
let isRotating = false;
let rotateStartAngle = 0;
let startRotation = 0;



// 角の判定に使う「ツマミ」の判定エリア（px）
const HANDLE_SIZE = 10; 

canvas.addEventListener("mousedown", (e) => {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

// 回転ハンドル
if (cropRect) {

    const centerX =
        cropRect.displayX +
        cropRect.displayWidth / 2;

    const centerY =
        cropRect.displayY +
        cropRect.displayHeight / 2;

    const rotatePoint =
        getRotatedPoint(
            centerX,
            centerY,

            cropRect.displayX,

            cropRect.displayY +
            cropRect.displayHeight,

            cropRect.rotation || 0
        );

    const rotateDist =
        Math.hypot(
            mouseX - rotatePoint.x,
            mouseY - rotatePoint.y
        );

    if (rotateDist < 12) {

        isRotating = true;

        rotateStartAngle =
            Math.atan2(
                mouseY - centerY,
                mouseX - centerX
            );

        startRotation =
            cropRect.rotation || 0;

        return;
    }
}
    // まだ枠がない場合は、通常通り新規選択モードへ
    if (!cropRect) {
        startX = mouseX;
        startY = mouseY;
        isDragging = true;
        return;
    }

    // ★修正：右下の角（ツマミ）は回転後の位置で判定する
    {
        const centerX =
            cropRect.displayX + cropRect.displayWidth / 2;
        const centerY =
            cropRect.displayY + cropRect.displayHeight / 2;

        const corner =
            getRotatedPoint(
                centerX,
                centerY,
                cropRect.displayX + cropRect.displayWidth,
                cropRect.displayY + cropRect.displayHeight,
                cropRect.rotation || 0
            );

        const cornerDist =
            Math.hypot(mouseX - corner.x, mouseY - corner.y);

        if (cornerDist < HANDLE_SIZE + 4) {

            isResizing = true;

            // リサイズ中、固定するアンカー（回転後の左上角）を記録
            const anchor =
                getRotatedPoint(
                    centerX,
                    centerY,
                    cropRect.displayX,
                    cropRect.displayY,
                    cropRect.rotation || 0
                );

            resizeAnchorX = anchor.x;
            resizeAnchorY = anchor.y;
            resizeRotation = cropRect.rotation || 0;

            return; // リサイズモードに入ったのでここで終了
        }
    }

    // 前回の移動判定：枠の「内側」をクリックした場合は移動モードへ（回転を考慮したローカル座標で判定）
    {
        const local = toLocalUnrotated(mouseX, mouseY);

        if (Math.abs(local.x) <= cropRect.displayWidth / 2 &&
            Math.abs(local.y) <= cropRect.displayHeight / 2) {

            isMoving = true;
            moveStartX = mouseX - cropRect.displayX;
            moveStartY = mouseY - cropRect.displayY;
            return;
        }
    }

    // 枠の外側をクリックした場合は、新しく枠を作り直す
    startX = mouseX;
    startY = mouseY;
    isDragging = true;
});

canvas.addEventListener("mousemove", (e) => {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

if (isRotating && cropRect) {

    const centerX =
        cropRect.displayX +
        cropRect.displayWidth / 2;

    const centerY =
        cropRect.displayY +
        cropRect.displayHeight / 2;

    const currentAngle =
        Math.atan2(
            mouseY - centerY,
            mouseX - centerX
        );

    cropRect.rotation =
        startRotation +
        (currentAngle - rotateStartAngle);

    drawCanvas();



    return;
}

    // 1. 【リサイズ（サイズ調整）モード】のときの処理
    //    回転していても破綻しないよう、固定したアンカー（回転後の左上角）から見た
    //    ローカル座標（回転前の向き）でマウス位置を測ってサイズを決める
    if (isResizing && cropRect) {

        const dx = mouseX - resizeAnchorX;
        const dy = mouseY - resizeAnchorY;

        // アンカーから見たローカル座標へ逆回転
        const localX =
            dx * Math.cos(resizeRotation) + dy * Math.sin(resizeRotation);
        const localY =
            -dx * Math.sin(resizeRotation) + dy * Math.cos(resizeRotation);

        // 正方形を維持するため、大きい方のサイズに合わせる
        let newSize = Math.max(localX, localY);

        if (newSize < 20) newSize = 20; // 最小サイズは 20px

        // 新しい中心位置（アンカーから見て (newSize/2, newSize/2) の位置を、
        // 元の回転角だけ回転させてスクリーン座標に戻す）
        const half = newSize / 2;
        const centerOffsetX =
            half * Math.cos(resizeRotation) - half * Math.sin(resizeRotation);
        const centerOffsetY =
            half * Math.sin(resizeRotation) + half * Math.cos(resizeRotation);

        const newCenterX = resizeAnchorX + centerOffsetX;
        const newCenterY = resizeAnchorY + centerOffsetY;

        cropRect.displayX = newCenterX - half;
        cropRect.displayY = newCenterY - half;
        cropRect.displayWidth = newSize;
        cropRect.displayHeight = newSize;

        cropRect.x = cropRect.displayX / displayScale;
        cropRect.y = cropRect.displayY / displayScale;
        cropRect.width = newSize / displayScale;
        cropRect.height = newSize / displayScale;

        drawCanvas();

        return;
    }

    // 2. 【移動モード】のときの処理
    if (isMoving && cropRect) {
        let newDisplayX = mouseX - moveStartX;
        let newDisplayY = mouseY - moveStartY;

        if (newDisplayX < 0) newDisplayX = 0;
        if (newDisplayY < 0) newDisplayY = 0;
        if (newDisplayX + cropRect.displayWidth > canvas.width) {
            newDisplayX = canvas.width - cropRect.displayWidth;
        }
        if (newDisplayY + cropRect.displayHeight > canvas.height) {
            newDisplayY = canvas.height - cropRect.displayHeight;
        }

        cropRect.displayX = newDisplayX;
        cropRect.displayY = newDisplayY;
        cropRect.x = newDisplayX / displayScale;
        cropRect.y = newDisplayY / displayScale;

        drawCanvas();
        drawResizeHandle(); // ツマミを再描画
        return;
    }

    


    // 3. 【新規選択モード】のときの処理
if (!isDragging) {

    if (cropRect) {

        const centerX =
            cropRect.displayX +
            cropRect.displayWidth / 2;

        const centerY =
            cropRect.displayY +
            cropRect.displayHeight / 2;

        const rotatePoint =
            getRotatedPoint(
                centerX,
                centerY,

                cropRect.displayX,

                cropRect.displayY +
                cropRect.displayHeight,

                cropRect.rotation || 0
            );

        const rotateDist =
            Math.hypot(
                mouseX - rotatePoint.x,
                mouseY - rotatePoint.y
            );

        // ★回転ハンドル
        if (rotateDist < 12) {

            canvas.style.cursor = "grab";
            return;
        }

        // ★リサイズハンドル（回転後の右下角で判定）
        const corner =
            getRotatedPoint(
                centerX,
                centerY,
                cropRect.displayX + cropRect.displayWidth,
                cropRect.displayY + cropRect.displayHeight,
                cropRect.rotation || 0
            );

        const cornerDist =
            Math.hypot(mouseX - corner.x, mouseY - corner.y);

        if (cornerDist < HANDLE_SIZE + 4) {

            canvas.style.cursor = "nwse-resize";
            return;
        }
    }

    canvas.style.cursor = "default";
    return;
}

    

    currentX = mouseX;
    currentY = mouseY;

    const dx = currentX - startX;
    const dy = currentY - startY;
    const size = Math.max(Math.abs(dx), Math.abs(dy));

    const displayX = dx >= 0 ? startX : startX - size;
    const displayY = dy >= 0 ? startY : startY - size;

        cropRect = {
    displayX,
    displayY,
    displayWidth: size,
    displayHeight: size,

    x: displayX / displayScale,
    y: displayY / displayScale,

    width: size / displayScale,
    height: size / displayScale,

    rotation: 0
};

    drawCanvas();
    drawResizeHandle();

});

canvas.addEventListener("mouseup", () => {

    isDragging = false;
    isMoving = false;
    isResizing = false;
    isRotating = false;

    canvas.style.cursor = "default";

    if (cropRect) {
        status.textContent =
            `選択範囲 X:${Math.round(cropRect.x)}
             Y:${Math.round(cropRect.y)}
             W:${Math.round(cropRect.width)}
             H:${Math.round(cropRect.height)}`;

             displayItems.forEach(item => {
            item.thumbnail = null;
        });

        renderPreviewGrid();
    }
    
});


canvas.addEventListener("mouseleave", () => {

    isDragging = false;
    isMoving = false;
    isResizing = false;
    isRotating = false;

});

// ★追加：右下の角に小さな「■（ツマミ）」を描画する関数
function drawResizeHandle() {

    if (!cropRect) return;

    const centerX =
        cropRect.displayX + cropRect.displayWidth / 2;
    const centerY =
        cropRect.displayY + cropRect.displayHeight / 2;

    const corner =
        getRotatedPoint(
            centerX,
            centerY,
            cropRect.displayX + cropRect.displayWidth,
            cropRect.displayY + cropRect.displayHeight,
            cropRect.rotation || 0
        );

    ctx.fillStyle = "red";

    ctx.fillRect(
        corner.x - 4,
        corner.y - 4,
        8,
        8
    );
}

function getRotatedPoint(
    centerX,
    centerY,
    x,
    y,
    angle
) {
    const dx = x - centerX;
    const dy = y - centerY;

    return {
        x:
            centerX +
            dx * Math.cos(angle) -
            dy * Math.sin(angle),

        y:
            centerY +
            dx * Math.sin(angle) +
            dy * Math.cos(angle)
    };
}

function drawRotateHandle() {

    if (!cropRect) return;

    const centerX =
        cropRect.displayX + cropRect.displayWidth / 2;
    const centerY =
        cropRect.displayY + cropRect.displayHeight / 2;

    const handlePoint =
        getRotatedPoint(
            centerX,
            centerY,
            cropRect.displayX,
            cropRect.displayY +
            cropRect.displayHeight,
            cropRect.rotation || 0
        );

    ctx.beginPath();

    ctx.arc(
        handlePoint.x,
        handlePoint.y,
        6,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "dodgerblue";
    ctx.fill();
}
generateButton.addEventListener(
    "click",
    async () => {

        if (!cropRect) {
            alert("顔範囲を選択してください");
            return;
        }

// ─── ★切り抜きアイコンのサイズ指定 ───
// 修正前: const cellSize = 220;



// ★修正後: 画面に入力されたサイズ数値を読み込む（空欄なら220にする）
        const cellSize = parseInt(cellSizeInput.value) || 220;
        
        // 既にファイル最上部で取得されている「fontSizeInput」変数をそのまま使うように修正
        const fontSize = parseInt(fontSizeInput.value) || 18;
        const labelHeight = fontSize * 1.6; // ★1.8倍に少し広げるとより安全で綺麗になります

        const titleHeight = 60;


        
        const columns =
            parseInt(columnInput.value);

        const gap =
            parseInt(gapInput.value);

// ★修正：縦と横の余白数値をそれぞれ画面から読み込む
        const outerGapY =
            parseInt(outerGapYInput.value) || 0;
        const outerGapX =
            parseInt(outerGapXInput.value) || 0; //空欄の場合は0にする


            const exportItems =
                displayItems.filter(
                    item => item.enabled
                );

            const rows =
                Math.ceil(
                    exportItems.length / columns
                );  

        const resultCanvas =
            document.createElement("canvas");

        generatedCanvas = resultCanvas;
            

        resultCanvas.id = "resultCanvas";

// ★修正：左右の外側余白に outerGapX を使う
        resultCanvas.width =
            (outerGapX * 2) +
            columns * cellSize +
            (columns - 1) * gap;

        // ★計算修正：チェックが外れていればタイトルの高さを0、入っていればtitleHeightにする
        const currentTitleHeight = toggleCharacterName.checked ? titleHeight : 0;

// ★修正：上下の外側余白に outerGapY を使う
        resultCanvas.height =
            (outerGapY * 2) +
            currentTitleHeight +
            rows * cellSize +
            rows * labelHeight +
            (rows - 1) * gap;
            
        const resultCtx =
            resultCanvas.getContext("2d");

        resultCtx.fillStyle =
            backgroundColor.value;
        resultCtx.fillRect(
            0,
            0,
            resultCanvas.width,
            resultCanvas.height
        );

 
        // チェックが入っている時だけキャラ名を描画
        if (toggleCharacterName.checked) {
            resultCtx.fillStyle = textColor.value;
            resultCtx.font = `32px '${fontFamilyInput.value}'`;
            resultCtx.textAlign = "center";
            resultCtx.fillText(
                characterName.value,
                resultCanvas.width / 2,
                80
            );
        }

        for (let i = 0; i < exportItems.length; i++) {
            const item = exportItems[i];
            const file = item.file;
            const img = await loadImage(file);
            const col = i % columns;
            const row = Math.floor(i / columns);

// ★修正：横方向のスタート位置を outerGapX にする
            const x = outerGapX + col * (cellSize + gap);
            
            // ★修正：縦方向のスタート位置を outerGapY にする
            const y =
                outerGapY +
                currentTitleHeight + 
                row * (cellSize + labelHeight + gap);

// ★追加：画面から角丸の半径（R）を読み込む
            const radius = parseInt(borderRadiusInput.value) || 0;

            // ─── 角丸のクリッピング（マスク）処理 ───
            resultCtx.save(); // 現在のキャンバスの状態（マスクがかかっていない状態）を保存
            
            resultCtx.beginPath();
            // キャンバス上に角丸四角形の形をなぞる命令
            resultCtx.roundRect(x, y, cellSize, cellSize, radius); 
            resultCtx.clip(); // なぞった角丸の形で型抜き（マスク）する

            // 型抜きされた状態で、背景色を塗る
            resultCtx.fillStyle = cellBackgroundColor.value;
            resultCtx.fillRect(x, y, cellSize, cellSize);

            // 回転付き切り出し（Photoshopの切り抜きツールと同様、
            // 枠の角度に合わせて元画像側を回転させてから切り出すことで
            // 絵そのものが傾いた状態で出力されるようにする）
const tempCanvas =
    document.createElement("canvas");

const tempCtx =
    tempCanvas.getContext("2d");

tempCanvas.width =
    cropRect.width;

tempCanvas.height =
    cropRect.height;

const cropCenterX =
    cropRect.x + cropRect.width / 2;

const cropCenterY =
    cropRect.y + cropRect.height / 2;

    tempCtx.save();

// 出力キャンバスの中心に移動
tempCtx.translate(
    cropRect.width / 2,
    cropRect.height / 2
);

// 枠の回転を打ち消す方向に元画像を回転させる
tempCtx.rotate(
    -cropRect.rotation
);

// 枠の中心が原点に来るように元画像をずらす
tempCtx.translate(
    -cropCenterX,
    -cropCenterY
);

// 元画像を等倍でそのまま描画（上記の変換で必要な部分だけが
// tempCanvasの範囲内に描かれる）
tempCtx.drawImage(
    img,
    0,
    0
);
tempCtx.restore();

resultCtx.drawImage(
    tempCanvas,
    x,
    y,
    cellSize,
    cellSize
);

resultCtx.restore();// キャンバスの状態を元に戻す（これがないと次のパーツまで型抜きされてしまいます）
            // ───────────────────────────────────────

            const label =
                file.name.replace(
                    /\.[^/.]+$/,
                    ""
                );

            resultCtx.fillStyle =
                textColor.value;

            resultCtx.font =
                `${fontSizeInput.value}px '${fontFamilyInput.value}'`;

            resultCtx.textAlign =
                "center";

// ─── 修正前 ───
            // resultCtx.fillText(label, x + cellSize / 2, y + cellSize + 20);

            // ─── ★修正後 ───
            // 画像のすぐ下（y + cellSize）に、「フォントサイズの約0.9倍」を足した位置に描く
            // これにより、文字サイズが大きくなっても常に画像の下に等間隔（10%〜20%のすき間）で配置されます
            resultCtx.fillText(
                label,
                x + cellSize / 2,
                y + cellSize + (fontSize * 1.0) 
            );
        }

        resultContainer.innerHTML =
            "";

        resultContainer.appendChild(
            resultCanvas
        );
    }
);

function loadImage(file) {

    return new Promise(
        (resolve) => {

            const img =
                new Image();

            img.onload =
                () => resolve(img);

            img.src =
                URL.createObjectURL(
                    file
                );
        }
    );
}

// ★保存ボタンのクリックイベント
saveButton.addEventListener(
    "click",
    () => {

        // Canvas（生成された画像）がそもそも無い場合は警告を出す
        if (!generatedCanvas) {
            alert("先にグリッドを生成してください");
            return;
        }

        // 画面のファイル名入力欄を取得
        const fileNameInput = document.getElementById("fileNameInput");
        
        // 入力欄が存在し、かつ文字が入力されていればその文字を使い、空欄なら「差分一覧」にする
        let finalFileName = "差分一覧";
        if (fileNameInput && fileNameInput.value.trim() !== "") {
            finalFileName = fileNameInput.value.trim();
        }

        // ダウンロード用のリンクを作って実行する
        const link = document.createElement("a");
        link.download = `${finalFileName}.png`;
        link.href = generatedCanvas.toDataURL("image/png");
        link.click();
    }
);



async function renderPreviewGrid() {

    previewGrid.innerHTML = "";

    if (!cropRect) {
        return;
    }

   for (
    let index = 0;
    index < displayItems.length;
    index++
) {

const item =
    displayItems[index];

const file =
    item.file;

if (!item.thumbnail) {

    const img =
        await loadImage(file);

    const thumbCanvas =
        document.createElement(
            "canvas"
        );

    thumbCanvas.width = 100;
    thumbCanvas.height = 100;

    const thumbCtx =
        thumbCanvas.getContext(
            "2d"
        );

thumbCtx.save();

const thumbCropCenterX =
    cropRect.x + cropRect.width / 2;

const thumbCropCenterY =
    cropRect.y + cropRect.height / 2;

const thumbScaleX = 100 / cropRect.width;
const thumbScaleY = 100 / cropRect.height;

// サムネイル中心へ移動
thumbCtx.translate(
    50,
    50
);

// 枠サイズを100x100に合わせて拡縮
thumbCtx.scale(
    thumbScaleX,
    thumbScaleY
);

// 枠の回転を打ち消す方向に元画像を回転させる
thumbCtx.rotate(
    -(cropRect.rotation || 0)
);

// 枠の中心が原点に来るように元画像をずらす
thumbCtx.translate(
    -thumbCropCenterX,
    -thumbCropCenterY
);

thumbCtx.drawImage(
    img,
    0,
    0
);

thumbCtx.restore();

    item.thumbnail =
        thumbCanvas.toDataURL();
}

        const cell =
            document.createElement(
                "div"
            );

        cell.className =
            "preview-cell";

            cell.draggable = true;
                    cell.dataset.index = index; // ★この1行を追加（並び替えの同期に必要になります）

        const imageElement =
            document.createElement(
                "img"
            );

imageElement.src =
    item.thumbnail;

        const label =
            document.createElement(
                "div"
            );

        label.className =
            "preview-label";

        label.textContent =
    item.label;

//★チェックボックス追加修正
    const checkbox =  
    document.createElement(
        "input"
    );

checkbox.type =
    "checkbox";

checkbox.checked =
    item.enabled;

checkbox.addEventListener(
    "change",
    () => {

        item.enabled =
            checkbox.checked;

        cell.classList.toggle(
            "disabled-item",
            !item.enabled
        );
    }
);
        
// ──────────────────────────────────────────────────────────
        // ★アップデート：挿入バー表示対応・超直感的ドラッグ＆ドロップ
        // ──────────────────────────────────────────────────────────
        cell.addEventListener("dragstart", () => {
            draggedPreviewIndex = index;
            cell.style.opacity = "0.5";
        });

        cell.addEventListener("dragend", () => {
            cell.style.opacity = "1";
            draggedPreviewIndex = null;
            
            // 残ってしまった挿入バーの表示クラスをきれいに全消去
            Array.from(previewGrid.children).forEach(child => {
                child.classList.remove("drag-insert-left", "drag-insert-right");
            });

            // 現在の画面の並び順を反映して内部データを並び替える
            const currentNodes = Array.from(previewGrid.children);
            const newDisplayItems = [];
            
            currentNodes.forEach(node => {
                const originalIdx = parseInt(node.dataset.index);
                newDisplayItems.push(displayItems[originalIdx]);
            });
            
            displayItems = newDisplayItems;
            renderPreviewGrid(); // リフレッシュ
        });

        cell.addEventListener("dragover", (e) => {
            e.preventDefault();
            
            if (draggedPreviewIndex === null) return;
            
            const draggedCell = previewGrid.children[draggedPreviewIndex];
            if (!draggedCell || draggedCell === cell) return;

            const rect = cell.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            
            // 一旦、このカードからバーのクラスを消す（毎フレーム判定するため）
            cell.classList.remove("drag-insert-left", "drag-insert-right");

            if (e.clientX < centerX) {
                // 左半分にホバー：左側にバーを表示
                cell.classList.add("drag-insert-left");
                previewGrid.insertBefore(draggedCell, cell);
            } else {
                // 右半分にホバー：右側にバーを表示
                cell.classList.add("drag-insert-right");
                previewGrid.insertBefore(draggedCell, cell.nextSibling);
            }
            
            draggedPreviewIndex = Array.from(previewGrid.children).indexOf(draggedCell);
        });

        // マウスがカードから外れたら、そのカードのバーは消す
        cell.addEventListener("dragleave", () => {
            cell.classList.remove("drag-insert-left", "drag-insert-right");
        });
        // ──────────────────────────────────────────────────────────

        cell.appendChild(
            imageElement
        );

        cell.appendChild(
            label
        );

        cell.appendChild(
            checkbox
        );

        if (!item.enabled) {

    cell.classList.add(
        "disabled-item"
    );
}
        previewGrid.appendChild(
            cell
        );
    }
}



document
    .getElementById(
        "loadFontsButton"
    )
    .addEventListener(
        "click",
        loadFonts
    );

// ★フォント読み込み用の関数（ローカル環境のエラー回避版）
async function loadFonts() {
    const fontSelect = document.getElementById("fontFamily");
    
    // 1. そもそもブラウザがこの機能に対応しているかチェック
    if (!('queryLocalFonts' in window)) {
        alert("お使いのブラウザはフォント一覧の取得に対応していません。ChromeやEdgeの最新版をお使いください。");
        return;
    }
    
    try {
        // 2. ローカル環境のChrome/Edge向け：明示的に「フォントを見てもいいか」の許可（権限）をブラウザに要求する
        // これを入れることで、エラーで即死するのを防ぎ、画面上部に「許可ポップアップ」を強制表示させます。
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const status = await navigator.permissions.query({ name: "local-fonts" });
                if (status.state === "denied") {
                    alert("ブラウザの設定でフォントへのアクセスが拒否されています。アドレスバーの左側などから許可してください。");
                    return;
                }
            } catch (pError) {
                // 一部ブラウザの古いバージョンでのエラー対策（念のため無視して続行）
                console.log("Permission query info:", pError);
            }
        }

        // 3. フォントの取得を実行
        const fonts = await window.queryLocalFonts();
        fontSelect.innerHTML = "";

        const fontNames = [...new Set(fonts.map(f => f.family))].sort();

        // 一般的なWindows PCに標準で入っているフォントを優先順に探し、
        // 見つかったものを初期選択にする（無ければ先頭のフォントのまま）
        const preferredDefaults = ["Meiryo", "Yu Gothic UI", "Yu Gothic", "MS PGothic", "MS Gothic"];
        const defaultFontName = preferredDefaults.find(name => fontNames.includes(name));

        fontNames.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;

            if (name === defaultFontName) {
                option.selected = true;
            }
            fontSelect.appendChild(option);
        });

        // 取得に成功したらボタンを消す
        document.getElementById("loadFontsButton").style.display = "none";
        
        // フォントが読み込まれたらプレビューを1回更新
        if (typeof updatePreview === "function") {
            updatePreview();
        }

    } catch (error) {
        console.error("フォント取得失敗の詳細:", error);
        // エラーの内容を開発者ツール(F12)で見られるようにしつつ、ユーザーには親切な案内を出す
        alert("フォントの取得中にエラーが発生しました。\n画面の上部（またはアドレスバーの左側）に『フォントのアクセス許可』を求めるポップアップが表示されている場合は、【許可】を押してからもう一度ボタンを押してください。");
    }

    // フォントが切り替わったらプレビューを更新（二重登録を防ぐため、一度イベントを外してから付け直すのが安全です）
    fontSelect.removeEventListener("change", updatePreview);
    fontSelect.addEventListener("change", updatePreview);
}
// ─── ★ここから下はフォント機能の外側に独立 ───

const fontPreview = document.getElementById("fontPreview");

// プレビューの文字を更新する関数
function updatePreview() {
    const fontSelect = document.getElementById("fontFamily");
    if (fontPreview && fontSelect) {
        fontPreview.textContent = characterName.value.trim() !== "" ? characterName.value : "プレビュー Preview 漢字表示";
        fontPreview.style.fontFamily = `'${fontSelect.value}'`;
    }
}

// キャラ名が入力された時の処理
characterName.addEventListener("input", () => {
    // 1. フォントプレビューの文字を更新
    updatePreview();

    // 2. 保存ファイル名入力欄をリアルタイムに同期
    const fInput = document.getElementById("fileNameInput");
    if (fInput) {
        // ユーザーがファイル名欄をカチッとクリックして入力中でなければ、名前を連動させる
        if (document.activeElement !== fInput) {
            fInput.value = characterName.value ? `${characterName.value}_差分一覧` : "";
        }
    }
});

/* ===================================================
   ★追加機能：ココフォリア用チャットパレットDL処理
   =================================================== */
document.getElementById("downloadPaletteButton").addEventListener("click", () => {
// 1. 現在プレビューグリッドに並んでいる子要素（サムネイルカード）をすべて直接取得
    const previewItems = document.getElementById("previewGrid").children;
    
    if (previewItems.length === 0) {
        alert("画像が読み込まれていません。フォルダを選択してください。");
        return;
    }

  const paletteLines = [];

    // 2. 各要素から「現在の差分名（入力欄の値）」を取得して @ をつける
    Array.from(previewItems).forEach(item => {
        // カードの中にある「すべての入力欄（inputタグ）」をとりあえず全部探す
        const allInputs = item.querySelectorAll("input");
        let name = "";

        // 見つかった入力欄の中から、文字が入っているものを探す
        allInputs.forEach(input => {
            // チェックボックスやボタンは無視して、文字が入力されている欄の値をゲット
            if (input.type !== "checkbox" && input.type !== "button" && input.type !== "file") {
                if (input.value.trim() !== "") {
                    name = input.value.trim();
                }
            }
        });

        // 【万が一inputタグじゃなかった場合の間違い探し用】
        // もし入力欄がそもそもinputタグですらない場合、カード内の文字をそのまま拾う
        if (!name) {
            name = item.textContent ? item.textContent.trim() : "";
        }
        
        // 拡張子（.png や .jpg など）が含まれていたら除去
        name = name.replace(/\.[^/.]+$/, "");
        
        // ココフォリアのチャパレ用に整形
        if (name && !name.includes("フォルダ未選択") && !name.includes("プレビュー")) {
            paletteLines.push(`@${name}`);
        }
    });
    
    if (paletteLines.length === 0) {
        alert("有効な差分名が見つかりませんでした。");
        return;
    }

    // 3. 改行で区切ったテキストデータを作成
    const textContent = paletteLines.join("\r\n"); // Windowsでも綺麗に開けるように改行コードを設定

// 4. 保存用のファイル名を設定（「キャラ名」に入力した文字列を優先して使用）
    const charNameInput = document.getElementById("characterName");
    const fileNameInput = document.getElementById("fileNameInput");
    
    let baseName = "";
    
    if (charNameInput && charNameInput.value.trim() !== "") {
        // キャラ名が入っていればそれを使う
        baseName = charNameInput.value.trim();
    } else if (fileNameInput && fileNameInput.value.trim() !== "") {
        // キャラ名が空で、保存ファイル名が入っていればそれを使う
        baseName = fileNameInput.value.trim();
    } else {
        // どちらも空ならデフォルト名
        baseName = "立ち絵";
    }

    // ご希望の「〇〇_チャパレ用.txt」の形に設定
    const downloadFileName = `${baseName}_差分チャパレ用.txt`;

    // 5. ブラウザの仕組みを使ってテキストファイルをダウンロード
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", downloadFileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

});