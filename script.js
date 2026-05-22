/* ============================================================
   script.js — 8-Puzzle DLS Visualizer
   Bao gồm:
     - Quản lý âm thanh retro
     - Quản lý giao diện (UI)
     - CÁC HÀM THUẬT TOÁN (DLS & IDS) — viết theo chuẩn sách vở
   ============================================================ */


/* ============================================================
   PHẦN 1 — ÂM THANH RETRO
   ============================================================ */

let audioCtx = null;
let useSound = true;

/**
 * Bật / tắt hiệu ứng âm thanh.
 * Được gọi khi người dùng click vào công tắc trên header.
 */
function toggleSound() {
    const soundToggle = document.getElementById('soundToggle');
    const soundText   = document.getElementById('soundText');

    useSound = !useSound;

    if (useSound) {
        soundToggle.classList.add('active');
        soundText.textContent = 'ON';
    } else {
        soundToggle.classList.remove('active');
        soundText.textContent = 'OFF';
    }
}

/**
 * Phát một âm thanh đơn giản kiểu retro dùng Web Audio API.
 *
 * @param {number} frequency - Tần số (Hz), ví dụ 440 = nốt La
 * @param {string} type      - Dạng sóng: 'square' | 'sawtooth' | 'sine'
 * @param {number} duration  - Thời lượng (giây)
 */
function playRetroSound(frequency, type, duration) {
    if (!useSound) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc      = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn('Audio Context error:', e);
    }
}

/** Tập hợp các mẫu âm thanh được dùng trong game */
const SOUNDS = {
    step:     () => playRetroSound(300, 'square', 0.08),
    backtrack:() => playRetroSound(150, 'sawtooth', 0.15),
    generate: () => playRetroSound(600, 'sine', 0.04),
    victory:  () => {
        playRetroSound(440, 'square', 0.1);
        setTimeout(() => playRetroSound(554, 'square', 0.1), 100);
        setTimeout(() => playRetroSound(659, 'square', 0.1), 200);
        setTimeout(() => playRetroSound(880, 'square', 0.3), 300);
    },
    failure:  () => {
        playRetroSound(220, 'sawtooth', 0.15);
        setTimeout(() => playRetroSound(180, 'sawtooth', 0.15), 150);
        setTimeout(() => playRetroSound(130, 'sawtooth', 0.3), 300);
    },
    limitUp:  () => {
        playRetroSound(400, 'sine', 0.1);
        setTimeout(() => playRetroSound(500, 'sine', 0.1), 100);
        setTimeout(() => playRetroSound(600, 'sine', 0.15), 200);
    }
};


/* ============================================================
   PHẦN 2 — DỮ LIỆU VÀ CẤU HÌNH BÀI TOÁN
   ============================================================ */

/**
 * Trạng thái đích (Goal State) của bài toán 8-Puzzle.
 * Mảng 9 phần tử, chỉ số 0..8 tương ứng với vị trí từ trái-trên → phải-dưới.
 * Số 0 đại diện cho ô trống.
 *
 *  Goal:
 *    1 2 3
 *    4 5 6
 *    7 8 _
 */
const GOAL_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 0];

/** Các bộ cấu hình mẫu (preset) sẵn để thử nhanh */
const PRESETS = {
    easy1 : [1, 2, 3, 4, 5, 0, 7, 8, 6], // 1 bước
    easy2 : [1, 2, 3, 4, 0, 5, 7, 8, 6], // 2 bước
    medium: [1, 0, 3, 4, 2, 5, 7, 8, 6], // 4 bước
    hard  : [0, 1, 3, 4, 2, 5, 7, 8, 6], // ~8 bước
};

/** Trạng thái bắt đầu hiện tại đang được chọn */
let currentStartState = [...PRESETS.easy2];


/* ============================================================
   PHẦN 3 — CẤU TRÚC DỮ LIỆU NODE
   ============================================================ */

/**
 * Lớp biểu diễn một NODE trong cây tìm kiếm.
 *
 * Theo lý thuyết sách vở (AIMA - Russell & Norvig):
 *   Node = { state, parent, action, depth }
 *
 * Ở đây ta lưu:
 *   - board : mảng 9 phần tử biểu diễn trạng thái bảng
 *   - path  : mảng các ký tự hành động dẫn đến đây ('U','D','L','R')
 *   - depth : độ sâu của node trong cây tìm kiếm
 */
class PuzzleNode {
    /**
     * @param {number[]} board  - Mảng 9 số biểu diễn bảng
     * @param {string[]} path   - Chuỗi hành động từ gốc đến đây
     * @param {number}   depth  - Độ sâu hiện tại trong cây
     */
    constructor(board, path = [], depth = 0) {
        this.board = board;
        this.path  = path;
        this.depth = depth;
    }
}


/* ============================================================
   PHẦN 4 — CÁC HÀM TIỆN ÍCH CHO BÀI TOÁN 8-PUZZLE
   ============================================================ */

/**
 * Kiểm tra một trạng thái có phải là trạng thái đích không.
 *
 * Theo lý thuyết:  GOAL-TEST(state) → true / false
 *
 * @param   {number[]} board - Mảng 9 số biểu diễn bảng
 * @returns {boolean}
 */
function isGoal(board) {
    for (let i = 0; i < 9; i++) {
        if (board[i] !== GOAL_STATE[i]) return false;
    }
    return true;
}

/**
 * Sinh tất cả các node con (successor nodes) từ một node hiện tại.
 *
 * Theo lý thuyết:  EXPAND(node, problem) → danh sách các child node
 *
 * Nguyên tắc di chuyển:
 *   Ô trống (0) có thể "dịch chuyển" theo 4 hướng:
 *     U (Up)    — ô trống đi lên   → số phía trên trượt xuống
 *     D (Down)  — ô trống đi xuống → số phía dưới trượt lên
 *     L (Left)  — ô trống đi trái  → số bên trái trượt phải
 *     R (Right) — ô trống đi phải  → số bên phải trượt trái
 *
 * @param   {PuzzleNode} node - Node cha cần mở rộng
 * @returns {PuzzleNode[]}    - Danh sách các node con hợp lệ
 */
function expand(node) {
    // Tìm vị trí ô trống (số 0) trong mảng 1 chiều
    const zeroIndex = node.board.indexOf(0);

    // Chuyển đổi chỉ số 1D → tọa độ 2D (hàng, cột) trong lưới 3×3
    const row = Math.floor(zeroIndex / 3);
    const col = zeroIndex % 3;

    // Định nghĩa 4 hướng di chuyển hợp lệ theo thứ tự ưu tiên sách vở: U, D, L, R
    const DIRECTIONS = [
        { deltaRow: -1, deltaCol:  0, action: 'U' },  // Lên
        { deltaRow:  1, deltaCol:  0, action: 'D' },  // Xuống
        { deltaRow:  0, deltaCol: -1, action: 'L' },  // Trái
        { deltaRow:  0, deltaCol:  1, action: 'R' },  // Phải
    ];

    const children = [];

    for (const dir of DIRECTIONS) {
        const newRow = row + dir.deltaRow;
        const newCol = col + dir.deltaCol;

        // Kiểm tra hướng di chuyển có nằm trong lưới 3×3 không
        const isInsideGrid = (newRow >= 0 && newRow < 3 && newCol >= 0 && newCol < 3);
        if (!isInsideGrid) continue;

        // Tạo bảng mới bằng cách hoán đổi ô trống với ô bên cạnh
        const newIndex   = newRow * 3 + newCol;
        const newBoard   = [...node.board];            // Sao chép bảng
        newBoard[zeroIndex] = newBoard[newIndex];      // Ô cạnh điền vào chỗ trống
        newBoard[newIndex]  = 0;                       // Ô trống dịch sang vị trí mới

        // Tạo node con với độ sâu tăng thêm 1
        const childNode = new PuzzleNode(
            newBoard,
            [...node.path, dir.action],   // Nối thêm hành động vào đường đi
            node.depth + 1
        );

        children.push(childNode);
    }

    return children;
}

/**
 * Kiểm tra tính giải được (solvability) của một bảng 8-Puzzle.
 *
 * Định lý: Một hoán vị 8-Puzzle giải được khi và chỉ khi
 *          số lượng nghịch thế (inversions) là SỐ CHẴN.
 *
 * Nghịch thế: cặp (i, j) với i < j nhưng board[i] > board[j] > 0
 *
 * @param   {number[]} board - Mảng 9 số
 * @returns {boolean}        - true nếu bảng có thể giải được
 */
function isSolvable(board) {
    // Loại bỏ ô trống (0) trước khi đếm nghịch thế
    const tiles = board.filter(x => x !== 0);
    let inversions = 0;

    for (let i = 0; i < tiles.length - 1; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i] > tiles[j]) inversions++;
        }
    }

    return inversions % 2 === 0; // Chẵn → giải được
}


/* ============================================================
   PHẦN 5 — THUẬT TOÁN DLS (DEPTH-LIMITED SEARCH)
             Phiên bản Generator để trực quan hóa từng bước
   ============================================================

   Pseudocode sách vở (AIMA, 4th ed.):
   ─────────────────────────────────────────────────────────
   function DEPTH-LIMITED-SEARCH(problem, l) returns node or failure or cutoff
       frontier ← a LIFO queue (stack) with NODE(problem.INITIAL) as element
       result   ← failure
       while frontier is not EMPTY do
           node ← POP(frontier)
           if problem.IS-GOAL(node.STATE) then return node
           if DEPTH(node) > l then
               result ← cutoff
           else if not IS-CYCLE(node) then
               for each child in EXPAND(problem, node) do
                   add child to frontier
       return result
   ─────────────────────────────────────────────────────────

   Lưu ý: Phiên bản này là GRAPH SEARCH (dùng bảng `reached`)
   thay vì TREE SEARCH, để tránh duyệt lại trạng thái đã qua.

   Hàm này là một JavaScript Generator (*) — mỗi lần gọi next()
   sẽ thực thi đến lệnh yield tiếp theo, cho phép trực quan hóa
   từng bước một trên giao diện.

   @param {number[]} startBoard   - Mảng 9 số — trạng thái bắt đầu
   @param {number}   depthLimit   - Giới hạn độ sâu l
   @param {string}   goalCheckMode- Kiểu kiểm tra đích:
                                    'evaluation' = kiểm tra khi POP (sách vở chuẩn)
                                    'generation' = kiểm tra khi PUSH (tối ưu hóa)
   @yields {object} Mỗi yield trả về một object mô tả sự kiện:
     { event, node, frontier, reached, reason }
*/
function* depthLimitedSearch(startBoard, depthLimit, goalCheckMode) {

    /* --- BƯỚC 1: Khởi tạo ---
       Tạo node gốc từ trạng thái bắt đầu.
       Đưa node gốc vào Frontier (ngăn xếp LIFO).
       Đưa trạng thái gốc vào Reached để tránh lặp.
    */
    const startNode = new PuzzleNode(startBoard, [], 0);
    const frontier  = [startNode];          // Stack (mảng JS, dùng push/pop)
    const reached   = new Map();             // Map: boardString → minDepth
    reached.set(startBoard.toString(), 0);

    logToConsole(`🌟 Khởi chạy DLS với Độ sâu Giới hạn (Limit) = ${depthLimit}...`);
    SOUNDS.limitUp();

    /* --- Kiểm tra đích tại node gốc (chế độ 'generation') ---
       Nếu trạng thái bắt đầu chính là đích, kết thúc ngay.
    */
    if (goalCheckMode === 'generation' && isGoal(startBoard)) {
        yield { event: 'success', node: startNode, frontier: [...frontier], reached: new Map(reached) };
        return; // ← Kết thúc generator
    }

    /* --- BƯỚC 2: Vòng lặp chính ---
       Lặp cho đến khi Frontier rỗng (thất bại) hoặc tìm thấy đích (thành công).
    */
    while (frontier.length > 0) {

        /* 2a. POP node từ đỉnh stack (LIFO — DFS behaviour) */
        const currentNode = frontier.pop();

        /* Yield 'evaluating': báo cho UI biết đang xét node này */
        yield {
            event    : 'evaluating',
            node     : currentNode,
            frontier : [...frontier],
            reached  : new Map(reached)
        };

        /* --- GOAL-TEST kiểu 'evaluation' (chuẩn sách vở) ---
           Kiểm tra sau khi POP. Đây là cách an toàn nhất, đảm bảo
           node tìm được thật sự nằm trong cây tìm kiếm đúng giới hạn.
        */
        if (goalCheckMode === 'evaluation' && isGoal(currentNode.board)) {
            yield { event: 'success', node: currentNode, frontier: [...frontier], reached: new Map(reached) };
            return; // ← Tìm thấy → kết thúc generator
        }

        /* --- Xét giới hạn độ sâu (CUTOFF) ---
           Nếu node hiện tại đã chạm Limit, không mở rộng tiếp.
           Đây chính là điểm khác biệt của DLS so với DFS thông thường.
        */
        if (currentNode.depth >= depthLimit) {
            yield {
                event   : 'backtrack',
                node    : currentNode,
                frontier: [...frontier],
                reached : new Map(reached),
                reason  : 'Limit Cutoff'  // Bị cắt vì đạt giới hạn độ sâu
            };
            continue; // Quay lại đầu vòng lặp, chọn node tiếp theo
        }

        /* --- BƯỚC 3: Mở rộng node (EXPAND) ---
           Sinh tất cả các node con từ node hiện tại.
           Kiểm tra từng node con trước khi đưa vào Frontier.
        */
        const childNodes = expand(currentNode);
        let addedAnyChild = false;

        for (const child of childNodes) {

            /* --- GOAL-TEST kiểu 'generation' (tối ưu hóa) ---
               Kiểm tra ngay khi sinh node con, không cần chờ POP.
               Nhanh hơn nhưng có thể bỏ qua các trường hợp biên.
            */
            if (goalCheckMode === 'generation' && isGoal(child.board)) {
                frontier.push(child);
                yield { event: 'success', node: child, frontier: [...frontier], reached: new Map(reached) };
                return; // ← Tìm thấy → kết thúc generator
            }

            const childKey = child.board.toString();

            /* --- Kiểm tra Reached (Graph Search — tránh chu trình) ---
               Thêm node con vào Frontier chỉ khi:
                 (1) Trạng thái này chưa xuất hiện trong reached, HOẶC
                 (2) Trạng thái này đã xuất hiện nhưng ở độ sâu SÂU HƠN
                     → tức là ta vừa tìm ra đường đi NGẮN HƠN đến nó.
            */
            const alreadyReached    = reached.has(childKey);
            const foundShorterPath  = alreadyReached && child.depth < reached.get(childKey);

            if (!alreadyReached || foundShorterPath) {
                reached.set(childKey, child.depth); // Cập nhật độ sâu tối thiểu
                frontier.push(child);               // Đẩy vào đỉnh stack
                addedAnyChild = true;

                yield {
                    event   : 'generating',
                    node    : child,
                    frontier: [...frontier],
                    reached : new Map(reached)
                };
            }
        }

        /* Nếu không có node con nào được thêm → backtrack vì chu trình */
        if (!addedAnyChild && childNodes.length > 0) {
            yield {
                event   : 'backtrack',
                node    : currentNode,
                frontier: [...frontier],
                reached : new Map(reached),
                reason  : 'Cycle Pruning'  // Bị cắt vì trùng trạng thái
            };
        }
    }

    /* --- BƯỚC 4: Frontier rỗng → Thất bại ---
       Đã duyệt hết không gian trạng thái trong giới hạn depthLimit
       mà không tìm thấy trạng thái đích.
    */
    yield { event: 'fail_limit', frontier: [], reached: new Map(reached) };
}


/* ============================================================
   PHẦN 6 — THUẬT TOÁN IDS (ITERATIVE DEEPENING SEARCH)
             Lớp điều phối bên ngoài (Outer Loop)
   ============================================================

   Pseudocode sách vở (AIMA, 4th ed.):
   ─────────────────────────────────────────────────────────
   function ITERATIVE-DEEPENING-SEARCH(problem) returns node or failure
       for depth = 0, 1, 2, … do
           result ← DEPTH-LIMITED-SEARCH(problem, depth)
           if result ≠ cutoff then return result
   ─────────────────────────────────────────────────────────

   Trong phiên bản visualizer này:
     - Mỗi vòng lặp `depth` là một lần chạy depthLimitedSearch()
     - Khi DLS yield 'fail_limit' → IDS tăng depth và bắt đầu DLS mới
     - Logic này nằm trong hàm stepVisualizer() và startSolving()
*/


/* ============================================================
   PHẦN 7 — QUẢN LÝ TRẠNG THÁI VISUALIZER
   ============================================================ */

let dlsIterator   = null;   // Iterator của DLS đang chạy
let timerId       = null;   // ID của setInterval
let isPaused      = false;  // Đang tạm dừng hay không
let isSearchComplete = false; // Đã kết thúc tìm kiếm chưa
let currentModeType  = 'iterative'; // 'iterative' | 'fixed'
let globalLimit      = 0;  // Giới hạn hiện tại của IDS
let userSetLimit     = 5;  // Giới hạn tĩnh do người dùng chọn
let simulationSpeed  = 50; // Tốc độ mô phỏng (ms)

/**
 * Bắt đầu quá trình giải bài toán.
 * Đọc cấu hình từ UI, khởi tạo DLS/IDS generator, bắt đầu vòng lặp.
 */
function startSolving() {
    // Dừng mọi mô phỏng cũ nếu còn đang chạy
    if (timerId) clearInterval(timerId);
    isPaused         = false;
    isSearchComplete = false;

    // Đọc cài đặt từ giao diện
    currentModeType = document.querySelector('input[name="searchMode"]:checked').value;
    userSetLimit    = parseInt(document.getElementById('depthLimitSlider').value);
    const goalCheckMode = document.querySelector('input[name="goalCheckMode"]:checked').value;

    // Kiểm tra bảng bắt đầu có giải được không
    if (!isSolvable(currentStartState)) {
        showModal('🚨 CẢNH BÁO', 'Bảng này không có lời giải! Mời bạn đổi Preset hoặc nhấn RANDOM.');
        return;
    }

    // Cập nhật trạng thái nút bấm
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStart').classList.add('opacity-50');
    document.getElementById('btnPause').disabled = false;
    document.getElementById('btnStep').disabled  = false;

    // Xóa log cũ
    document.getElementById('gameLogs').innerHTML = '';
    logToConsole(`[BẮT ĐẦU]: Trạng thái bắt đầu: [${currentStartState.join(', ')}]`);
    logToConsole(`[CẤU HÌNH]: Goal Check = ${goalCheckMode === 'evaluation' ? 'Khi xét Node (POP)' : 'Khi sinh Node (PUSH)'}`);

    if (currentModeType === 'iterative') {
        // IDS: bắt đầu từ giới hạn 0, tự động tăng dần
        globalLimit = 0;
        logToConsole(`[IDS]: Bắt đầu Iterative Deepening từ Limit = 0...`);
    } else {
        // DLS đơn với giới hạn cố định do người dùng chọn
        globalLimit = userSetLimit;
        logToConsole(`[DLS]: Chạy với Fixed Limit = ${globalLimit}`);
    }

    initiateDlsWithLimit(globalLimit, goalCheckMode);
    playLoop();
}

/**
 * Khởi tạo một DLS generator mới với giới hạn độ sâu cho trước.
 * Được gọi mỗi khi IDS tăng limit hoặc khi người dùng nhấn Bắt đầu.
 *
 * @param {number} limit          - Giới hạn độ sâu
 * @param {string} goalCheckMode  - Kiểu kiểm tra đích
 */
function initiateDlsWithLimit(limit, goalCheckMode) {
    document.getElementById('currentLimitBadge').innerText = limit;
    dlsIterator = depthLimitedSearch(currentStartState, limit, goalCheckMode);
}

/**
 * Bắt đầu vòng lặp tự động (auto-play) theo tốc độ đã cài đặt.
 */
function playLoop() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        if (!isPaused) {
            stepVisualizer();
        }
    }, simulationSpeed);
}

/**
 * Thực hiện MỘT bước tiếp theo trong DLS generator.
 * Được gọi bởi vòng lặp tự động hoặc khi người dùng nhấn "Bước Tiếp".
 *
 * Đây là nơi IDS outer loop được thực hiện:
 *   - Khi DLS yield 'fail_limit' → tăng limit → tạo DLS mới (IDS)
 *   - Khi DLS yield 'success'    → hiển thị kết quả và kết thúc
 */
function stepVisualizer() {
    if (isSearchComplete) return;

    const result = dlsIterator.next();

    if (!result.done) {
        // DLS vẫn đang chạy, xử lý sự kiện yield
        const stepInfo = result.value;

        // Cập nhật UI Frontier và Reached
        if (stepInfo.frontier) renderFrontier(stepInfo.frontier);
        if (stepInfo.reached)  renderReached(stepInfo.reached);

        switch (stepInfo.event) {

            case 'evaluating':
                // Đang xét (expand) một node: hiển thị lên bảng chính
                renderBoard(stepInfo.node.board);
                document.getElementById('currentNodeDepth').innerText = stepInfo.node.depth;
                document.getElementById('currentNodePath').innerText  =
                    stepInfo.node.path.length > 0 ? stepInfo.node.path.join(' ➔ ') : 'Bắt đầu';
                logToConsole(`-> Xét Node [${stepInfo.node.board.join('')}] | Depth = ${stepInfo.node.depth}`);
                SOUNDS.step();
                break;

            case 'generating':
                // Vừa sinh một node con và đưa vào Frontier
                logToConsole(`  ↳ Sinh node con [${stepInfo.node.board.join('')}] | Depth = ${stepInfo.node.depth}`);
                SOUNDS.generate();
                break;

            case 'backtrack':
                // Quay lui: hoặc vì đạt Limit hoặc vì chu trình
                logToConsole(`⬅️ Backtrack tại [${stepInfo.node.board.join('')}] | Lý do: ${stepInfo.reason}`);
                SOUNDS.backtrack();
                break;

            case 'success':
                // === TÌM THẤY ĐỂ ĐẶT! ===
                handleSuccess(stepInfo.node);
                break;
        }

    } else {
        // DLS generator đã kết thúc (frontier rỗng = fail_limit)
        handleDlsFinished();
    }
}

/**
 * Xử lý khi tìm thấy trạng thái đích thành công.
 * @param {PuzzleNode} node - Node đích vừa tìm được
 */
function handleSuccess(node) {
    isSearchComplete = true;
    clearInterval(timerId);

    renderBoard(node.board);
    document.getElementById('currentNodeDepth').innerText = node.depth;
    document.getElementById('currentNodePath').innerText  = node.path.join(' ➔ ');

    logToConsole(`🏆 THÀNH CÔNG! Tìm thấy Goal ở Depth = ${node.depth}!`);
    logToConsole(`Đường đi: ${node.path.join(' ➔ ')}`);
    SOUNDS.victory();

    showModal(
        '🏆 THÀNH CÔNG!',
        `Thuật toán đã tìm thấy Đích với Limit = ${globalLimit}.<br><br>
         <strong>Số bước:</strong> ${node.depth}<br>
         <strong>Đường đi:</strong> <span class="text-yellow-400 font-bold font-mono">${node.path.join(' ➔ ')}</span>`
    );

    finishSolving();
}

/**
 * Xử lý khi một vòng DLS kết thúc mà không tìm thấy đích.
 *
 * Nếu đang ở chế độ IDS → tăng limit và chạy lại DLS (IDS outer loop).
 * Nếu đang ở chế độ Fixed → thông báo thất bại.
 */
function handleDlsFinished() {
    const goalCheckMode = document.querySelector('input[name="goalCheckMode"]:checked').value;

    if (currentModeType === 'iterative') {
        // --- IDS: OUTER LOOP — tăng limit ---
        globalLimit++;

        if (globalLimit > 15) {
            // Giới hạn an toàn để không treo trình duyệt
            isSearchComplete = true;
            clearInterval(timerId);
            logToConsole(`❌ Đã vượt quá giới hạn an toàn (Depth 15). Dừng thuật toán.`);
            SOUNDS.failure();
            showModal('💀 CHẠM GIỚI HẠN AN TOÀN', 'Không tìm thấy giải pháp dưới độ sâu 15.');
            finishSolving();
        } else {
            logToConsole(`🔄 [IDS]: Không tìm thấy ở Limit = ${globalLimit - 1}. Tăng lên Limit = ${globalLimit}...`);
            initiateDlsWithLimit(globalLimit, goalCheckMode);
            SOUNDS.limitUp();
        }

    } else {
        // --- DLS Fixed: Thất bại hoàn toàn ---
        isSearchComplete = true;
        clearInterval(timerId);
        logToConsole(`❌ THẤT BẠI: Không tìm thấy Goal trong Fixed Limit = ${globalLimit}.`);
        SOUNDS.failure();
        showModal('👾 GAME OVER', `Không tìm thấy lời giải tại Limit = ${globalLimit}. Thử tăng Limit hoặc dùng IDS.`);
        finishSolving();
    }
}

/** Đặt lại trạng thái các nút sau khi tìm kiếm kết thúc */
function finishSolving() {
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStart').classList.remove('opacity-50');
    document.getElementById('btnPause').disabled = true;
    document.getElementById('btnStep').disabled  = true;
}

/** Tạm dừng / tiếp tục mô phỏng */
function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('btnPause');
    if (isPaused) {
        btn.innerText  = '▶️ TIẾP TỤC';
        btn.className  = btn.className.replace('pixel-btn-secondary', 'pixel-btn-primary');
        logToConsole('[HỆ THỐNG]: Đã tạm dừng.');
    } else {
        btn.innerText  = '⏸️ TẠM DỪNG';
        btn.className  = btn.className.replace('pixel-btn-primary', 'pixel-btn-secondary');
        logToConsole('[HỆ THỐNG]: Tiếp tục chạy...');
        SOUNDS.step();
    }
}

/** Đặt lại hoàn toàn visualizer về trạng thái ban đầu */
function resetVisualizer() {
    if (timerId) clearInterval(timerId);
    isPaused         = false;
    isSearchComplete = false;

    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStart').classList.remove('opacity-50');
    document.getElementById('btnPause').disabled = true;
    document.getElementById('btnPause').innerText = '⏸️ TẠM DỪNG';
    document.getElementById('btnPause').className = 'pixel-btn pixel-btn-secondary py-2 text-[10px]';
    document.getElementById('btnStep').disabled = true;
    document.getElementById('currentNodeDepth').innerText = '0';
    document.getElementById('currentNodePath').innerText  = 'Bắt đầu';
    document.getElementById('currentLimitBadge').innerText = '0';

    renderBoard(currentStartState);
    document.getElementById('frontierContainer').innerHTML = `<div class="text-center text-gray-500 text-xs py-8 font-mono">[RỖNG]</div>`;
    document.getElementById('reachedContainer').innerHTML  = `<div class="text-center text-gray-500 text-xs py-8 font-mono">[RỖNG]</div>`;
    document.getElementById('frontierCount').innerText = '0';
    document.getElementById('reachedCount').innerText  = '0';
    document.getElementById('gameLogs').innerHTML = '<p>[Hệ thống]: Đã đặt lại. Sẵn sàng khởi chạy mới!</p>';
    SOUNDS.step();
}


/* ============================================================
   PHẦN 8 — RENDER GIAO DIỆN
   ============================================================ */

/**
 * Vẽ bảng 8-Puzzle lên thẻ #mainBoard.
 * Ô đúng vị trí Goal sẽ được tô màu xanh lá.
 *
 * @param {number[]} board - Mảng 9 số
 */
function renderBoard(board) {
    const boardEl = document.getElementById('mainBoard');
    boardEl.innerHTML = '';

    for (let i = 0; i < 9; i++) {
        const val  = board[i];
        const tile = document.createElement('div');

        if (val === 0) {
            // Ô trống
            tile.className = 'flex items-center justify-center bg-slate-950 border-2 border-dashed border-gray-700 w-full h-full text-slate-800 text-lg font-bold font-mono';
            tile.innerText = '0';
        } else {
            // Ô số — kiểm tra có đúng vị trí Goal không
            const isCorrect = (val === GOAL_STATE[i]);

            tile.className = 'flex items-center justify-center border-4 rounded-none w-full h-full font-bold transition-all select-none';
            tile.style.fontFamily = "'Press Start 2P', cursive";
            tile.style.fontSize   = '1.5rem';

            if (isCorrect) {
                // Ô đúng vị trí: tô màu xanh lá
                tile.style.backgroundColor = '#d1fae5';
                tile.style.boxShadow       = 'inset -4px -4px 0px #10b981, 3px 3px 0px rgba(0,0,0,0.5)';
                tile.style.color           = '#065f46';
                tile.style.textShadow      = '2px 2px 0px #34d399';
                tile.style.borderColor     = '#10b981';
            } else {
                // Ô thường
                tile.style.backgroundColor = '#e0e7ff';
                tile.style.boxShadow       = 'inset -4px -4px 0px #94a3b8, 3px 3px 0px rgba(0,0,0,0.5)';
                tile.style.color           = '#1e293b';
                tile.style.textShadow      = '2px 2px 0px #94a3b8';
                tile.style.borderColor     = '#475569';
            }

            tile.innerText = val;
        }

        boardEl.appendChild(tile);
    }
}

/**
 * Vẽ danh sách Frontier (ngăn xếp LIFO) lên panel bên phải.
 * Node ở đỉnh stack (chỉ số cuối mảng) hiển thị ở trên cùng.
 *
 * @param {PuzzleNode[]} stack - Mảng các node trong frontier
 */
function renderFrontier(stack) {
    const container = document.getElementById('frontierContainer');
    document.getElementById('frontierCount').innerText = stack.length;

    if (stack.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 font-mono">[RỖNG]</div>`;
        return;
    }

    container.innerHTML = '';

    // Hiển thị từ đỉnh stack (cuối mảng) xuống đáy (đầu mảng)
    for (let i = stack.length - 1; i >= 0; i--) {
        const node = stack[i];

        // Mini grid 3×3
        let miniGridHtml = `<div class="grid grid-cols-3 gap-0.5 w-12 h-12 border border-blue-900 bg-slate-900 p-0.5 mr-2 flex-shrink-0">`;
        for (let t = 0; t < 9; t++) {
            const v         = node.board[t];
            const cellColor = v === 0 ? 'bg-black' : (v === GOAL_STATE[t] ? 'bg-emerald-600' : 'bg-slate-700');
            miniGridHtml   += `<div class="${cellColor} w-full h-full"></div>`;
        }
        miniGridHtml += `</div>`;

        let pathStr = node.path.length > 0 ? node.path.join('') : 'None';
        if (pathStr.length > 10) pathStr = '...' + pathStr.slice(-8);

        const div = document.createElement('div');
        div.className = 'bg-slate-950 p-2 border border-blue-700 flex items-center justify-between text-xs font-mono hover:bg-slate-900 transition-colors';
        div.innerHTML = `
            <div class="flex items-center">
                ${miniGridHtml}
                <div>
                    <div class="text-yellow-400 font-bold">Node #${i}</div>
                    <div class="text-gray-400">Depth: <span class="text-white">${node.depth}</span></div>
                    <div class="text-[10px] text-cyan-400 truncate max-w-[80px]">Path: ${pathStr}</div>
                </div>
            </div>
            <div class="text-[9px] bg-blue-900 px-1 py-0.5 text-blue-200">STACK</div>`;
        container.appendChild(div);
    }
}

/**
 * Vẽ danh sách Reached (tập đã khám phá) lên panel bên phải.
 * Hiển thị tối đa 15 mục gần nhất để tránh tràn bộ nhớ.
 *
 * @param {Map} reachedMap - Map: boardString → minDepth
 */
function renderReached(reachedMap) {
    const container = document.getElementById('reachedContainer');
    document.getElementById('reachedCount').innerText = reachedMap.size;

    if (reachedMap.size === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 font-mono">[RỖNG]</div>`;
        return;
    }

    container.innerHTML = '';
    const entries    = Array.from(reachedMap.entries());
    const maxDisplay = Math.min(entries.length, 15);

    for (let i = entries.length - 1; i >= entries.length - maxDisplay; i--) {
        const [boardStr, depth] = entries[i];
        const boardArr = boardStr.split(',').map(Number);

        let miniGridHtml = `<div class="grid grid-cols-3 gap-0.5 w-10 h-10 border border-purple-900 bg-slate-900 p-0.5 mr-2 flex-shrink-0">`;
        for (let t = 0; t < 9; t++) {
            const v         = boardArr[t];
            const cellColor = v === 0 ? 'bg-black' : 'bg-slate-700';
            miniGridHtml   += `<div class="${cellColor} w-full h-full"></div>`;
        }
        miniGridHtml += `</div>`;

        const div = document.createElement('div');
        div.className = 'bg-slate-950 p-2 border border-purple-800 flex items-center justify-between text-xs font-mono';
        div.innerHTML = `
            <div class="flex items-center">
                ${miniGridHtml}
                <div>
                    <div class="text-gray-400">Min Depth: <span class="text-yellow-400 font-bold">${depth}</span></div>
                    <div class="text-[9px] text-purple-400 truncate max-w-[100px]">${boardStr}</div>
                </div>
            </div>
            <span class="text-[9px] bg-purple-900 px-1 py-0.5 text-purple-200">OK</span>`;
        container.appendChild(div);
    }

    if (entries.length > 15) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'text-center text-[10px] text-gray-500 font-mono py-1';
        moreDiv.innerText = `... và ${entries.length - 15} mục khác`;
        container.appendChild(moreDiv);
    }
}

/** Ghi một dòng log vào console panel */
function logToConsole(message) {
    const logsEl = document.getElementById('gameLogs');
    const p      = document.createElement('p');
    p.textContent = message;
    logsEl.appendChild(p);
    logsEl.scrollTop = logsEl.scrollHeight; // Tự cuộn xuống dòng mới nhất
}


/* ============================================================
   PHẦN 9 — QUẢN LÝ TRẠNG THÁI BẮT ĐẦU & INPUT
   ============================================================ */

/** Nạp một bảng preset có sẵn */
function setPreset(key) {
    if (!PRESETS[key]) return;
    currentStartState = [...PRESETS[key]];
    for (let i = 0; i < 9; i++) {
        document.getElementById(`tile-input-${i}`).value = currentStartState[i];
    }
    checkSolvabilityStatus();
    renderBoard(currentStartState);
    logToConsole(`[Hệ thống]: Đã nạp preset "${key.toUpperCase()}": [${currentStartState.join(', ')}]`);
    SOUNDS.generate();
}

/** Áp dụng mảng do người dùng nhập thủ công */
function applyCustomState() {
    const arr    = [];
    const counts = new Array(9).fill(0);

    for (let i = 0; i < 9; i++) {
        const val = parseInt(document.getElementById(`tile-input-${i}`).value);
        if (isNaN(val) || val < 0 || val > 8) {
            showModal('🚨 LỖI NHẬP LIỆU', 'Các ô phải là số nguyên từ 0 đến 8!');
            return;
        }
        counts[val]++;
        arr.push(val);
    }

    // Đảm bảo mỗi số từ 0..8 xuất hiện đúng 1 lần
    for (let i = 0; i < 9; i++) {
        if (counts[i] !== 1) {
            showModal('🚨 LỖI CẤU HÌNH', 'Bảng phải chứa đủ các số từ 0 đến 8, không lặp!');
            return;
        }
    }

    currentStartState = [...arr];
    checkSolvabilityStatus();
    renderBoard(currentStartState);
    logToConsole(`[Hệ thống]: Đã áp dụng mảng: [${currentStartState.join(', ')}]`);
    SOUNDS.generate();
}

/** Cập nhật nhãn kiểm tra solvability dưới lưới nhập */
function checkSolvabilityStatus() {
    const arr = [];
    for (let i = 0; i < 9; i++) {
        const val = parseInt(document.getElementById(`tile-input-${i}`).value);
        arr.push(isNaN(val) ? 0 : val);
    }

    const statusEl = document.getElementById('solvabilityStatus');
    if (isSolvable(arr)) {
        statusEl.innerHTML = '💚 Trạng thái GIẢI ĐƯỢC (Solvable)';
        statusEl.className = 'text-[11px] text-center text-green-400 mt-2 font-mono';
    } else {
        statusEl.innerHTML = '💔 Không thể giải (Unsolvable)';
        statusEl.className = 'text-[11px] text-center text-red-400 mt-2 font-mono';
    }
}

/** Tạo ngẫu nhiên một bảng hợp lệ (giải được) */
function generateRandomSolvable() {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    do {
        // Fisher-Yates shuffle
        for (let i = arr.length - 1; i > 0; i--) {
            const j   = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i];
            arr[i]    = arr[j];
            arr[j]    = tmp;
        }
    } while (!isSolvable(arr) || arr.toString() === GOAL_STATE.toString());

    currentStartState = [...arr];
    for (let i = 0; i < 9; i++) {
        document.getElementById(`tile-input-${i}`).value = currentStartState[i];
    }
    checkSolvabilityStatus();
    renderBoard(currentStartState);
    logToConsole(`[Hệ thống]: Random state: [${currentStartState.join(', ')}]`);
    SOUNDS.generate();
}


/* ============================================================
   PHẦN 10 — MODAL & SLIDER SETUP
   ============================================================ */

function showModal(title, content) {
    document.getElementById('modalTitle').innerHTML   = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    SOUNDS.step();
}

function setupSpeedSlider() {
    const slider  = document.getElementById('speedSlider');
    const display = document.getElementById('speedName');

    const update = () => {
        const val = parseInt(slider.value);
        simulationSpeed = val;
        let label = '';
        if      (val > 350) label = '🐢 SLOWPOKE';
        else if (val > 150) label = '🐕 REGULAR';
        else if (val >  50) label = '🏎️ SONIC';
        else                label = '⚡ TURBO';
        display.innerText = `${label} (${val}ms)`;
    };

    slider.addEventListener('input', update);
    update();
}

function setupLimitSlider() {
    const slider  = document.getElementById('depthLimitSlider');
    const display = document.getElementById('limitValueDisplay');
    slider.addEventListener('input', () => { display.innerText = slider.value; });
}


/* ============================================================
   PHẦN 11 — KHỞI ĐỘNG KHI TRANG TẢI XONG
   ============================================================ */

window.onload = function () {
    // Sinh lưới nhập thủ công 3×3
    const container = document.getElementById('customGridInputs');
    container.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const input       = document.createElement('input');
        input.type        = 'number';
        input.min         = 0;
        input.max         = 8;
        input.value       = currentStartState[i];
        input.className   = 'w-full text-center bg-gray-900 border border-gray-600 text-yellow-400 font-bold font-mono py-1 text-sm';
        input.id          = `tile-input-${i}`;
        input.addEventListener('change', checkSolvabilityStatus);
        container.appendChild(input);
    }

    checkSolvabilityStatus();
    renderBoard(currentStartState);
    setupSpeedSlider();
    setupLimitSlider();

    // Ẩn/hiện slider Limit tùy chế độ tìm kiếm
    document.querySelectorAll('input[name="searchMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const container = document.getElementById('fixedLimitContainer');
            if (e.target.value === 'fixed') {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        });
    });
};