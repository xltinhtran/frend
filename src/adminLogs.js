// GHI ĐÈ BẰNG HÀM MỚI CHIA NGÀY NÀY NHÉ:
import { getActivityLogs, logActivity } from "./api.js";

window.renderActivityLog = async function(filterDate = "") {
    const logContainer = document.getElementById("adminActivityLog");
    if (!logContainer) return;

    // Giữ khung cố định chiều cao tránh dài trang
    logContainer.classList.add("max-h-[500px]", "overflow-y-auto", "overflow-x-hidden", "pr-2");

    try {
        // TỰ ĐỘNG NỐI THAM SỐ NGÀY VÀO API NẾU CÓ CHỌN
        const res = await getActivityLogs(filterDate);
        if (!res.ok) throw new Error("Không thể tải nhật ký");
        const logs = await res.json();

        if (logs.length === 0) {
            logContainer.innerHTML = `<p class="text-slate-400 text-sm italic text-center py-4">Không có hoạt động nào trong ngày này</p>`;
            return;
        }

        // 1. Thuật toán gom nhóm theo ngày
        const groupedLogs = logs.reduce((acc, log) => {
            const dateObj = new Date(log.createdAt);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let dateLabel = dateObj.toLocaleDateString("vi-VN");
            if (dateObj.toDateString() === today.toDateString()) dateLabel = "Hôm nay";
            else if (dateObj.toDateString() === yesterday.toDateString()) dateLabel = "Hôm qua";

            if (!acc[dateLabel]) acc[dateLabel] = [];
            acc[dateLabel].push(log);
            return acc;
        }, {});

        // 2. Render giao diện có thanh phân cách
        let html = '';
        for (const [date, dailyLogs] of Object.entries(groupedLogs)) {
            html += `
                <div class="relative z-10 flex items-center justify-center my-4">
                    <span class="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                        ${date}
                    </span>
                </div>
            `;
            
            html += dailyLogs.map(log => {
                const timeStr = new Date(log.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
                return `
                <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${log.bgColor || 'bg-slate-100'} ${log.color || 'text-slate-500'} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <span class="material-symbols-outlined text-sm">${log.icon || 'history'}</span>
                    </div>
                    <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs font-bold text-slate-400"><span class="material-symbols-outlined text-[10px]">schedule</span> ${timeStr}</span>
                        </div>
                        <div class="text-sm text-slate-700 leading-snug"><strong>${log.username}</strong> ${log.actionText}</div>
                    </div>
                </div>
                `;
            }).join("");
        }
        logContainer.innerHTML = html;
    } catch (err) {
        logContainer.innerHTML = `<p class="text-red-400 text-xs italic text-center py-4">Lỗi tải dữ liệu máy chủ!</p>`;
    }
};

// Gắn hàm renderActivityLog vào luồng chạy chung của Dashboard
const originalRenderDashboard = window.renderAdminDashboard;
window.renderAdminDashboard = function() {
    if (originalRenderDashboard) originalRenderDashboard();
    window.renderActivityLog(); 
};
// Hàm gửi log hoạt động lên SQL Server
window.logSystemActivity = async function(actionText, icon, color, bgColor) {
    const userStr = localStorage.getItem("quizlet_user");
    if (!userStr) return; // Chưa đăng nhập thì không lưu log
    
    const user = JSON.parse(userStr);
    try {
        await logActivity({
            userId: user.id,
            actionText: actionText,
            icon: icon || "star",
            color: color || "text-slate-500",
            bgColor: bgColor || "bg-slate-100"
        });
    } catch (e) {
        console.error("Lỗi không lưu được log:", e);
    }
};
