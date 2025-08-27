
    const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

    createApp({
      setup() {
        // Tabs
const tabs = [
  { key: 'form',           label: '注文フォーム',         icon: 'fa-utensils' },
  { key: 'orders',         label: '注文状況一覧',         icon: 'fa-receipt' },
  { key: 'monthlyHistory', label: '月次注文履歴',         icon: 'fa-book' },
  { key: 'monthly',        label: '従業員別・月次集計',   icon: 'fa-file-invoice-dollar' },
  { key: 'menu',           label: '献立表',             icon: 'fa-book-open' },
];
        const activeTab = ref('form');

        // Dates
        const today = new Date();
        const fmtDate = (d) => {
          const dt = new Date(d);
          const y = dt.getFullYear();
          const m = String(dt.getMonth()+1).padStart(2,'0');
          const da = String(dt.getDate()).padStart(2,'0');
          return `${y}-${m}-${da}`;
        };

        // --- Mock Data ---
        const employees = ['山田 太郎', '佐藤 花子', '鈴木 一郎', '田中 美咲'];

        // メニュー（基本パレット）
        const baseMenus = [
          { id: 1, name: '日替わりA弁当', price: 500, emoji: '🍱' },
          { id: 2, name: 'カレーライス', price: 450, emoji: '🍛' },
          { id: 3, name: '焼き魚定食', price: 600, emoji: '🐟' },
          { id: 4, name: 'ヘルシーサラダ弁当', price: 550, emoji: '🥗' },
        ];

        // 日付→その日のメニュー（初期は baseMenus の先頭2-3品）
        const menuPlan = reactive({});

        // 注文データ（モック）
        const orders = ref([
          { id: 1, date: fmtDate(today), employee: '山田 太郎', items: [{ id: 2, name:'カレーライス', qty: 1, price: 450 }], amount: 450 },
          { id: 2, date: fmtDate(today), employee: '佐藤 花子', items: [{ id: 1, name:'日替わりA弁当', qty: 1, price: 500 }], amount: 500 },
          { id: 3, date: fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()-1)), employee: '鈴木 一郎', items: [{ id: 3, name:'焼き魚定食', qty: 2, price: 600 }], amount: 1200 },
        ]);

        // --- 1. 注文フォーム ---
        const orderDate = ref(fmtDate(today));
        const cart = reactive({});

        const menusForDate = computed(() => {
          const list = menuPlan[orderDate.value];
          if (list && list.length) return list;
          // デフォルト（曜日で変えるなど適当に）
          const weekday = new Date(orderDate.value).getDay();
          if (weekday === 1 || weekday === 3) return baseMenus.slice(0,3);
          return baseMenus.slice(1,4);
        });

        // 初期数量 0
        watch(menusForDate, (list) => {
          list.forEach(m => { if (cart[m.id] == null) cart[m.id] = 0; });
        }, { immediate: true });

        const totalQty = computed(() => Object.entries(cart).reduce((s,[id,q]) => s + (q||0), 0));
        const totalAmount = computed(() => menusForDate.value.reduce((sum, m) => sum + (cart[m.id]||0)*m.price, 0));

        const recentOrders = computed(() => orders.value
          .slice()
          .sort((a,b)=> b.date.localeCompare(a.date))
          .slice(0,6));

        const placeOrder = () => {
          if (totalQty.value === 0) return;
          // ランダムに従業員を割り当て（モック）
          const emp = employees[Math.floor(Math.random()*employees.length)];
          const items = menusForDate.value.filter(m => (cart[m.id]||0) > 0).map(m => ({ id: m.id, name: m.name, qty: cart[m.id], price: m.price }));
          const amount = items.reduce((s,i)=> s + i.qty*i.price, 0);
          orders.value.push({ id: Date.now(), date: orderDate.value, employee: emp, items, amount });
          // クリア
          for (const k in cart) cart[k] = 0;
          alert(`注文を登録しました。\n従業員: ${emp}\n合計: ￥${amount.toLocaleString()}`);
        };

        // --- 2. 注文状況一覧 ---
        const listDate = ref(fmtDate(today));
        const ordersForDate = computed(() => orders.value.filter(o => o.date === listDate.value));
        const dayTotals = computed(() => ({
          totalQty: ordersForDate.value.reduce((s,o)=> s + o.items.reduce((x,i)=>x+i.qty,0),0),
          totalAmount: ordersForDate.value.reduce((s,o)=> s + o.amount, 0),
        }));
        const aggregatedMenu = computed(() => {
          const map = new Map();
          ordersForDate.value.forEach(o => o.items.forEach(i => {
            if (!map.has(i.id)) map.set(i.id, { id: i.id, name: i.name, price: i.price, qty: 0 });
            map.get(i.id).qty += i.qty;
          }));
          return Array.from(map.values());
        });

        const downloadOrderList = () => {
          alert('OrderList: Excel出力機能対応中。');
        };

// --- monthly history (personal)---
const historyMonth = ref(fmtDate(today).slice(0,7)); // Default bulan ini, format YYYY-MM

    const monthlyHistory = computed(() => {
      // CATATAN: Saat ini kita filter semua data pesanan yang ada.
      // Nanti setelah ada login, ini harus difilter berdasarkan ID karyawan yang sedang login.
      return orders.value
        .filter(o => o.date.startsWith(historyMonth.value))
        .sort((a, b) => b.date.localeCompare(a.date)); // Urutkan dari tanggal terbaru
    });

    const historyGrandTotal = computed(() =>
      monthlyHistory.value.reduce((sum, order) => sum + order.amount, 0)
    );

        // --- 3. 月別集計 ---
        const targetMonth = ref(fmtDate(today).slice(0,7)); // YYYY-MM
        const monthlyOrders = computed(() => orders.value.filter(o => o.date.startsWith(targetMonth.value)));
        const monthlyByEmployee = computed(() => {
          const m = new Map();
          monthlyOrders.value.forEach(o => {
            const v = m.get(o.employee) || { employee: o.employee, count: 0, total: 0 };
            v.count += 1;
            v.total += o.amount;
            m.set(o.employee, v);
          });
          return Array.from(m.values()).sort((a,b)=> b.total - a.total);
        });
        const monthlyGrandTotal = computed(() => monthlyByEmployee.value.reduce((s,r)=> s + r.total, 0));

        // const downloadCSV = () => {
        //   const rows = [['従業員','注文回数','合計金額']].concat(
        //     monthlyByEmployee.value.map(r => [r.employee, r.count, r.total])
        //   );
        //   const csv = rows.map(r => r.join(',')).join('\n');
        //   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        //   const url = URL.createObjectURL(blob);
        //   const a = document.createElement('a');
        //   a.href = url; a.download = `monthly_${targetMonth.value}.csv`; a.click();
        //   URL.revokeObjectURL(url);
        // };
        const downloadMonthly = () => {
          alert('Monthly: Excel出力機能対応中。');
        };

        
        // --- 4. 献立表（カレンダー） ---
        const menuMonth = ref(fmtDate(today).slice(0,7));
        const firstDayOfMonth = computed(() => new Date(Number(menuMonth.value.slice(0,4)), Number(menuMonth.value.slice(5,7))-1, 1));
        const calendarCells = computed(() => {
          const y = firstDayOfMonth.value.getFullYear();
          const m = firstDayOfMonth.value.getMonth();
          const start = new Date(y, m, 1);
          const end = new Date(y, m + 1, 0);
          const startIdx = start.getDay();
          const totalDays = end.getDate();
          const cells = [];
          // 前月の空き
          for (let i=0;i<startIdx;i++) {
            cells.push({ inMonth:false, day:'', date:null, menus:[] });
          }
          for (let d=1; d<=totalDays; d++) {
            const dateStr = fmtDate(new Date(y, m, d));
            const menus = (menuPlan[dateStr] && menuPlan[dateStr].length) ? menuPlan[dateStr] : (d%2? baseMenus.slice(0,2) : baseMenus.slice(1,3));
            cells.push({ inMonth:true, day:d, date:dateStr, menus });
          }
          // 末尾の空き
          while (cells.length % 7 !== 0) cells.push({ inMonth:false, day:'', date:null, menus:[] });
          return cells;
        });

        // 編集モーダル
        const editor = reactive({ open:false, date:null, form:[{name:'', price:0},{name:'', price:0}] });
        const openEditor = (date) => {
          if (!date) return;
          editor.open = true; editor.date = date;
          const list = menuPlan[date] || [];
          editor.form[0] = { name: list[0]?.name || '', price: list[0]?.price || 0 };
          editor.form[1] = { name: list[1]?.name || '', price: list[1]?.price || 0 };
          editor.form[2] = { name: list[2]?.name || '', price: list[2]?.price || 0 };
          editor.form[3] = { name: list[3]?.name || '', price: list[3]?.price || 0 };
          editor.form[4] = { name: list[4]?.name || '', price: list[4]?.price || 0 };
        };
        const applyEditor = () => {
          const payload = editor.form.filter(x => x.name?.trim());
          menuPlan[editor.date] = payload.map((x,idx) => ({ id: 1000+idx, name: x.name.trim(), price: Number(x.price)||0, emoji: '🍱' }));
          editor.open = false;
        };
        const saveMenuPlan = () => {
          alert('献立を保存しました（モック）。');
        };

        // 初期化
        onMounted(() => {
          // デモ用：本日・翌日・翌々日の献立を事前設定
          const d0 = fmtDate(today);
          const d1 = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()+1));
          const d2 = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()+2));
          menuPlan[d0] = [baseMenus[0], baseMenus[1]];
          menuPlan[d1] = [baseMenus[2], baseMenus[3]];
          menuPlan[d2] = [baseMenus[1], baseMenus[2]];
        });

        return {
          // state & utils
          tabs, activeTab, today, fmtDate,
          // form
          orderDate, menusForDate, cart, totalQty, totalAmount, placeOrder, recentOrders,
          // orders list
          listDate, ordersForDate, dayTotals, aggregatedMenu, downloadOrderList,
          // monthly
          targetMonth, monthlyByEmployee, monthlyGrandTotal, /*downloadCSV,*/ downloadMonthly,
          // monthly history
          historyMonth, monthlyHistory, historyGrandTotal,
          // menu plan
          menuMonth, calendarCells, openEditor, editor, applyEditor, saveMenuPlan,
        };
      }
    }).mount('#app');