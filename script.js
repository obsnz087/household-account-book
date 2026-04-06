// ==========================================
// 1. 初期設定 & Supabase接続
// ==========================================
const SUPABASE_URL = 'https://zrkfgkrnaqyjvgmldyso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya2Zna3JuYXF5anZnbWxkeXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjY5NTMsImV4cCI6MjA4NjkwMjk1M30.Oc3XPZnK71UNwUGiDpfvFnZAxbiyPdXCJNQNN4C2wYs';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 状態管理用変数
let history = [];
let myChart = null; // グラフのインスタンスを保持する変数
let lineChart = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
const moneyForm = document.getElementById('money-form');
let currentCategory = 'all';

// カテゴリーの定義
const categoryOptions = {
    expense: [
        { value: 'food', label: '食費' },
        { value: 'transport', label: '交通費' },
        { value: 'entertainment', label: '交際費' },
        { value: 'hobby', label: '趣味・嗜好' },
        { value: 'subsc', label: 'サブスク' },
        { value: 'otherExp', label: 'その他支出' }
    ],
    income: [
        { value: 'salary', label: '給与' },
        { value: 'income', label: 'おこづかい' },
        { value: 'carry_over', label: '繰越金' },
        { value: 'otherInc', label: 'その他収入' }
    ]
};

// ==========================================
// 2. 表示更新メイン関数 (updateHistoryDisplay)
// ==========================================
function updateHistoryDisplay() {
    // 年・月の表示を更新
    updateText('display-year', currentYear);

    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    // --- 【追加】ラベルの文字を切り替える ---
    const diffLabels = document.querySelectorAll('.js-diff-label');
    const labelText = (currentMonth === 'annual') ? '前年比' : '前月比';

    diffLabels.forEach(label => {
        label.innerText = labelText;
    });

    // --- ① データのソート & 抽出 ---
    // 日付の新しい順に並び替え
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 選択中の年・月に一致するデータのみ抽出
    const filteredHistory = history.filter(item => {
        const d = new Date(item.date);

        // 年月の判定
        const isYearMatch = d.getFullYear() === currentYear;
        const isMonthMatch = (currentMonth === 'annual') || ((d.getMonth() + 1) === currentMonth);

        // 【追加】カテゴリーの判定
        const isCategoryMatch = (currentCategory === 'all') || (item.category === currentCategory);

        return isYearMatch && isMonthMatch && isCategoryMatch;
    });

    // --- ② 集計処理 ---
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let carryOverAmount = 0; // 繰越金カテゴリー用
    let catTotals = { food: 0, transport: 0, entertainment: 0, hobby: 0, subsc: 0, otherExp: 0, salary: 0, pocketMoney: 0, otherInc: 0 };

    // 全期間（総資産用）
    history.forEach(item => {
        if (item.type === 'income') totalIncome += item.amount;
        else totalExpense += item.amount;
    });

    // 今月分（月別・カテゴリー別）
    filteredHistory.forEach(item => {
        if (item.type === 'income') {
            if (item.category === 'carry_over') carryOverAmount += item.amount;
            else monthlyIncome += item.amount;

            // カテゴリー集計
            if (item.category === 'salary') catTotals.salary += item.amount;
            else if (item.category === 'income') catTotals.pocketMoney += item.amount;
            else if (item.category !== 'carry_over') catTotals.otherInc += item.amount;
        } else {
            monthlyExpense += item.amount;
            if (item.category === 'food') catTotals.food += item.amount;
            else if (item.category === 'transport') catTotals.transport += item.amount;
            else if (item.category === 'entertainment') catTotals.entertainment += item.amount;
            else if (item.category === 'hobby') catTotals.hobby += item.amount;
            else if (item.category === 'subsc') catTotals.subsc += item.amount;
            else catTotals.otherExp += item.amount;
        }
    });

    // 選択された月の末日を取得する
    const lastDayOfMonth = new Date(currentYear, currentMonth === 'annual' ? 12 : currentMonth, 0);

    // 「アプリ開始時」から「選択した月の末日」までの全データを抽出
    const historyUpToNow = history.filter(item => {
        return new Date(item.date) <= lastDayOfMonth;
    });

    // その時点での総残高を計算（累積和）
    const currentBalance = historyUpToNow.reduce((acc, item) => {
        return item.type === 'income' ? acc + item.amount : acc - item.amount;
    }, 0);

    // --- ③ 画面描画 (DOM反映) ---
    // 基本収支
    updateText('display-income', `${monthlyIncome.toLocaleString()}`);
    updateText('display-expense', `${monthlyExpense.toLocaleString()}`);
    updateText('display-total', `${currentBalance.toLocaleString()}`);

    // 収入 - 支出
    const diffAmount = monthlyIncome - monthlyExpense;
    const diffEl = document.getElementById('display-diff');
    if (diffEl) {
        diffEl.innerText = `${diffAmount.toLocaleString()}`;
        diffEl.style.color = diffAmount < 0 ? "#d95252" : "#000";
    }

    // 繰越金表示 (1月の時だけエリアがある場合に表示)
    if (currentMonth === 'annual') {
        updateText('carry-over-display', `前年からの繰越: ¥ ${carryOverAmount.toLocaleString()}`);
    }

    // カテゴリー内訳
    updateText('cat-food', `¥ ${catTotals.food.toLocaleString()}`);
    updateText('cat-transport', `¥ ${catTotals.transport.toLocaleString()}`);
    updateText('cat-entertainment', `¥ ${catTotals.entertainment.toLocaleString()}`);
    updateText('cat-hobby', `¥ ${catTotals.hobby.toLocaleString()}`);
    updateText('cat-subsc', `¥ ${catTotals.subsc.toLocaleString()}`);
    updateText('cat-other-exp', `¥ ${catTotals.otherExp.toLocaleString()}`);

    updateText('cat-salary', `¥ ${catTotals.salary.toLocaleString()}`);
    updateText('cat-pocket-money', `¥ ${catTotals.pocketMoney.toLocaleString()}`);
    updateText('cat-other-inc', `¥ ${catTotals.otherInc.toLocaleString()}`);

    updateChart(catTotals);

    // テーブルの描画
    historyList.innerHTML = '';

    let dayTotal = 0;   // その日の合計（収支）
    let dayCount = 0;   // その日の登録件数

    filteredHistory.forEach((item, index) => {
        // 1. その日の合計と件数をカウント
        const amount = item.type === 'expense' ? -item.amount : item.amount;
        dayTotal += amount;
        dayCount++;

        // 2. 通常の明細行を作成して追加
        const tr = document.createElement('tr');



        const amountClass = item.type === 'expense' ? 'is-expense' : 'is-income';
        const sign = item.type === 'expense' ? '-' : '+';
        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${getCategoryLabel(item.category)}</td>
            <td class="${amountClass}">${sign} ¥${item.amount.toLocaleString()}</td>
            <td>${item.memo || '-'}</td>
            <td><button class="delete-btn" onclick="deleteTransaction('${item.id}')">削除</button></td>
        `;
        historyList.appendChild(tr);

        // 3. 【重要】「次のデータの日付が違う」または「これが最後のデータ」なら合計行を出す
        const nextItem = filteredHistory[index + 1];
        const isLastItem = index === filteredHistory.length - 1;

        if (isLastItem || nextItem.date !== item.date) {
            // 同じ日に複数（2件以上）ある場合のみ合計を表示する
            const totalTr = document.createElement('tr');
            totalTr.className = 'daily-total-row'; // スタイル用のクラス

            const totalSign = dayTotal >= 0 ? "+" : "";
            const totalColor = dayTotal >= 0 ? "#3d9b3d" : "#d95252";

            totalTr.innerHTML = `
                <td colspan="2" style="font-weight: 600;">この日の合計:</td>
                <td colspan="3" style="font-weight: bold; color: ${totalColor}; text-align: left;">
                    ${totalSign} ¥${dayTotal.toLocaleString()}
                </td>
            `;
            historyList.appendChild(totalTr);

            // 日付が変わるのでリセット
            dayTotal = 0;
            dayCount = 0;
        }
    });

    // 前月比の計算
    calculatePrevMonthDiff(monthlyIncome, monthlyExpense);

    //円グラフ・棒グラフの表示制御
    if (currentMonth === 'annual') {
        document.getElementById('annual-chart-container').style.display = 'block';
        document.getElementById('expense-chart-container').style.display = 'none'; // 円グラフの親
        renderLineChart();
    } else {
        document.getElementById('annual-chart-container').style.display = 'none';
        document.getElementById('expense-chart-container').style.display = 'block';
        updateChart(catTotals); // 以前作った円グラフ
    }
}

// ==========================================
// 6. chart.js
// ==========================================

function updateChart(catTotals) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // グラフに表示するデータ
    const data = {
        labels: ['食費', '交通費', '交際費', '趣味・嗜好', 'サブスク', 'その他'],
        datasets: [{
            data: [
                catTotals.food,
                catTotals.transport,
                catTotals.entertainment,
                catTotals.hobby,
                catTotals.subsc,
                catTotals.otherExp
            ],
            backgroundColor: [
                '#FF6384', // 食費：ピンク
                '#36A2EB', // 交通費：青
                '#FFCE56', // 交際費：黄
                '#9966ff',  // その他：緑
                '#87aa66',  // その他：緑
                '#4BC0C0'  // その他：緑
            ],
            hoverOffset: 4
        }]
    };

    // すでにグラフが存在する場合は、一度壊してから作り直す（再描画のバグ防止）
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'doughnut', // ドーナツグラフ（円グラフ pie も選べます）
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 30,
                    bottom: 30
                }
            },
            plugins: {
                legend: {
                    position: 'bottom', // 凡例を下に表示
                }
            }
        }
    });
}

function renderLineChart() {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    if (lineChart) lineChart.destroy();

    const stats = getMonthlyStatsData();

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            datasets: [
                {
                    label: '総資産',
                    data: stats.monthlyBalances,
                    borderColor: '#102C57', // 濃い紺
                    backgroundColor: 'rgba(16, 44, 87, 0.1)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y', // メインの軸
                },
                {
                    label: '月間収入',
                    data: stats.monthlyIncomes,
                    borderColor: '#3d9b3d', // 緑
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    yAxisID: 'y1', // 右側の軸（金額の桁が違う場合用）
                },
                {
                    label: '月間支出',
                    data: stats.monthlyExpenses,
                    borderColor: '#d95252', // 赤
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false } // X軸の縦線を消すとスッキリします
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: false, text: '総資産' },
                    beginAtZero: false,      // 資産額なら false の方が推移が強調されます
                    grace: '5%',              // 上下に少しだけ余白を作る
                    ticks: {
                        // ここでラベルの表示形式をカスタマイズ
                        callback: function (value, index, values) {
                            if (Math.abs(value) >= 1000) {
                                return (value / 10000) + '万';
                            }
                            return value;
                        },
                        // フォントサイズを小さくする
                        font: {
                            size: 10
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // 右側のグリッド線は消す
                    title: { display: false, text: '月間収支' },
                    ticks: {
                        // ここでラベルの表示形式をカスタマイズ
                        callback: function (value, index, values) {
                            if (Math.abs(value) >= 1000) {
                                return (value / 10000) + '万';
                            }
                            return value;
                        },
                        // フォントサイズを小さくする
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// 12ヶ月分の「残高」「収入」「支出」をまとめて取得する
function getMonthlyStatsData() {
    const monthlyBalances = [];
    const monthlyIncomes = [];
    const monthlyExpenses = [];

    for (let m = 1; m <= 12; m++) {
        // その月の開始日と末日
        const startOfMonth = new Date(currentYear, m - 1, 1);
        const endOfMonth = new Date(currentYear, m, 0);

        // ① その月「だけ」の集計（収入・支出）
        const currentMonthData = history.filter(item => {
            const d = new Date(item.date);
            return d >= startOfMonth && d <= endOfMonth;
        });

        const inc = currentMonthData
            .filter(item => item.type === 'income' && item.category !== 'carry_over')
            .reduce((acc, item) => acc + item.amount, 0);

        const exp = currentMonthData
            .filter(item => item.type === 'expense')
            .reduce((acc, item) => acc + item.amount, 0);

        // ② その月の「末日時点」での総残高（累積）
        const balance = history
            .filter(item => new Date(item.date) <= endOfMonth)
            .reduce((acc, item) => item.type === 'income' ? acc + item.amount : acc - item.amount, 0);

        monthlyIncomes.push(inc);
        monthlyExpenses.push(exp);
        monthlyBalances.push(balance);
    }

    return { monthlyBalances, monthlyIncomes, monthlyExpenses };
}
// ==========================================
// 3. データ操作関数 (Supabase通信)
// ==========================================
async function fetchTransactions() {
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*');

    if (error) {
        console.error("読み込みエラー:", error);
    } else {
        history = data || [];
        updateHistoryDisplay();
    }
}

async function deleteTransaction(id) {
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) alert("削除失敗");
    else fetchTransactions();
}

let isLoginMode = true; // ログインか新規登録かのフラグ

// 画面切り替え（ログイン ↔ アプリ）
function toggleView(user) {
    const authView = document.getElementById('auth-container');
    const appView = document.getElementById('app-container');

    if (user) {
        authView.style.display = 'none';
        appView.style.display = 'block';
        fetchTransactions(); // ログインしたらデータを取得
    } else {
        authView.style.display = 'flex';
        appView.style.display = 'none';
    }
}

// フォーム送信時の処理
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (isLoginMode) {
        // ログイン処理
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("ログイン失敗: " + error.message);
    } else {
        // 新規登録処理
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert("登録エラー: " + error.message);
        else alert("確認メールを送信しました！メール内のリンクをクリックしてください。");
    }
});

// ログイン/新規登録のモード切替
document.getElementById('auth-toggle').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "AnalyWallet へようこそ！" : "新規登録";
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? "ログイン" : "登録する";
    document.getElementById('auth-toggle').innerText = isLoginMode ? "新規登録はこちら" : "ログインはこちら";
});

// ログアウト処理
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// 認証状態を監視（リロードしてもログインを維持するための重要コード）
supabaseClient.auth.onAuthStateChange((event, session) => {
    toggleView(session?.user);
});

// ==========================================
// 4. ヘルパー関数 & UIイベント
// ==========================================
function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function getCategoryLabel(val) {
    const allOpts = [...categoryOptions.expense, ...categoryOptions.income];
    const opt = allOpts.find(o => o.value === val);
    return opt ? opt.label : val;
}

function updateCategoryMenu(type) {
    const sel = document.getElementById('category');
    if (!sel) return;
    sel.innerHTML = '';
    categoryOptions[type].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        sel.appendChild(o);
    });
}

function calculatePrevMonthDiff(currInc, currExp) {
    let prevInc = 0;
    let prevExp = 0;

    if (currentMonth === 'annual') {
        // --- 年間サマリーモード：前年（去年1年間）のデータを抽出 ---
        const prevYearData = history.filter(item => {
            const d = new Date(item.date);
            return d.getFullYear() === currentYear - 1; // 去年のデータ
        });

        prevYearData.forEach(item => {
            if (item.category !== 'carry_over') {
                if (item.type === 'income') prevInc += item.amount;
                else prevExp += item.amount;
            }
        });
    } else {
        // --- 通常モード：前月のデータを抽出（既存のロジック） ---
        const pm = currentMonth === 1 ? 12 : currentMonth - 1;
        const py = currentMonth === 1 ? currentYear - 1 : currentYear;

        const prevMonthData = history.filter(item => {
            const d = new Date(item.date);
            return d.getFullYear() === py && (d.getMonth() + 1) === pm;
        });

        prevMonthData.forEach(item => {
            if (item.category !== 'carry_over') {
                if (item.type === 'income') prevInc += item.amount;
                else prevExp += item.amount;
            }
        });
    }

    // 画面への反映はそのまま
    setDiffText('prev-diff-income', currInc - prevInc, false);
    setDiffText('prev-diff-expense', currExp - prevExp, true);
    setDiffText('prev-diff-net', (currInc - currExp) - (prevInc - prevExp), false);
}

function setDiffText(id, val, isExp) {
    const el = document.getElementById(id);
    if (!el) return;
    const sign = val > 0 ? "+" : "";
    el.innerText = `¥ ${sign}${val.toLocaleString()}`;
    if (isExp) el.style.color = val > 0 ? "#d95252" : "#3d9b3d";
    else el.style.color = val > 0 ? "#3d9b3d" : "#d95252";
}

// ==========================================
// 5. イベントリスナー登録
// ==========================================

// 年切り替え
document.getElementById('prev-year')?.addEventListener('click', () => { currentYear--; updateHistoryDisplay(); });
document.getElementById('next-year')?.addEventListener('click', () => { currentYear++; updateHistoryDisplay(); });

// 月ボタンのクリックイベント
document.querySelectorAll('.month_btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.month_btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // data-month が 'annual' なら文字列として、数字なら数値として保存
        const val = btn.dataset.month;
        currentMonth = val === 'annual' ? 'annual' : Number(val);

        updateHistoryDisplay();
    });
});

// 収支切り替え
document.querySelectorAll('input[name="transaction-type"]').forEach(r => {
    r.addEventListener('change', (e) => updateCategoryMenu(e.target.value));
});

// 今日の日付をフォームの初期値に設定する
function setDefaultDate() {
    const dateInput = document.querySelector('input[name="date"]');
    if (!dateInput) return;

    // JavaScriptで「今日」を取得して、YYYY-MM-DD形式に変換
    const now = new Date();

    // 日本時間に合わせた YYYY-MM-DD の作成
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 月は0から始まるので+1
    const day = String(now.getDate()).padStart(2, '0');

    const today = `${year}-${month}-${day}`;

    // フォームにセット！
    dateInput.value = today;
}

// 初期実行に加える
setDefaultDate();

// フォーム送信
moneyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(moneyForm);
    const type = fd.get('transaction-type');
    const cat = fd.get('category');

    // バリデーション
    if (type === 'income' && ['food', 'transport', 'entertainment'].includes(cat)) {
        alert("収支とカテゴリーが矛盾しています"); return;
    }

    const { error } = await supabaseClient.from('transactions').insert([{
        type: type, date: fd.get('date'), amount: Number(fd.get('amount')),
        category: cat, memo: fd.get('memo')
    }]);

    if (error) alert("保存に失敗しました...");
    else { alert("保存しました"); moneyForm.reset(); updateCategoryMenu('expense'); fetchTransactions(); }
});

document.getElementById('filter-category')?.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    updateHistoryDisplay(); // 選択が変わるたびに再描画
});

// 初期起動
updateCategoryMenu('expense');
const initialBtn = document.querySelector(`.month_btn[data-month="${currentMonth}"]`);
if (initialBtn) initialBtn.classList.add('active');
fetchTransactions();

//
//
//

// サインアップ（新規登録）
async function signUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });
    if (error) alert("登録エラー: " + error.message);
    else alert("確認メールを送信しました！");
}

// ログイン
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) alert("ログインエラー: " + error.message);
    else {
        alert("ログイン成功！");
        fetchTransactions(); // 自分のデータを取得
    }
}

// ログアウト
async function signOut() {
    await supabaseClient.auth.signOut();
    history = []; // データを空にする
    updateHistoryDisplay();
}