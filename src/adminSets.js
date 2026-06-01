// Biến lưu trạng thái đang "Xem tất cả" hay "Thu gọn"
import { getAllStudySets } from "./api.js";

window.isViewAllSets = false;

// Hàm kích hoạt khi bấm nút "Xem tất cả"
window.toggleViewAllSets = function() {
    window.isViewAllSets = !window.isViewAllSets; // Đảo trạng thái công tắc
    window.renderPopularSets(); // Yêu cầu vẽ lại bảng
};

// ============================================================
// HÀM RENDER BỘ THẺ PHỔ BIẾN (TÍNH % THEO SỐ LƯỢNG NGƯỜI HỌC)
// ============================================================
window.renderPopularSets = async function() {
    const container = document.getElementById("adminPopularSets");
    if (!container) return;

    try {
        const res = await getAllStudySets();
        let sets = await res.json();
        
        if (!sets || sets.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm italic text-center mt-4">Chưa có bộ thẻ nào.</p>`;
            return;
        }

        // 1. SẮP XẾP: Bộ nào nhiều người học nhất (learnerCount lớn nhất) xếp lên đầu, chưa ai học về cuối
        sets.sort((a, b) => (b.learnerCount || 0) - (a.learnerCount || 0));

        // Cập nhật trạng thái nút Xem tất cả / Thu gọn
        const btn = document.getElementById("btnViewAllSets");
        if (btn) {
            btn.innerHTML = window.isViewAllSets 
                ? `Thu gọn <span class="material-symbols-outlined text-sm">expand_less</span>`
                : `Xem tất cả <span class="material-symbols-outlined text-sm">arrow_forward</span>`;
        }

        // Nếu không bật "Xem tất cả", mặc định chỉ hiện Top 5
        if (!window.isViewAllSets) {
            sets = sets.slice(0, 5);
        }
        
        // 2. LẤY MỐC 100%: Số lượng người học của bộ đứng TOP 1
        const maxLearners = (sets[0].learnerCount && sets[0].learnerCount > 0) ? sets[0].learnerCount : 1;

        const html = sets.map((set, index) => {
            const currentLearners = set.learnerCount || 0;
            
            // 3. THUẬT TOÁN TÍNH % THEO NGƯỜI HỌC: (Số người học bộ này / Số người học bộ Top 1) * 100
            let percent = Math.round((currentLearners / maxLearners) * 100);
            
            // Đổi màu sắc linh hoạt theo độ hot của bộ thẻ
            let colorClass = "bg-indigo-600"; // Phổ biến nhất (Full 100%)
            if (percent <= 60 && percent > 0) colorClass = "bg-teal-600"; // Trung bình
            if (percent === 0) colorClass = "bg-slate-200"; // Chưa ai học
            
            // Đổ icon huy chương cho Top 3 bộ hot nhất
            let rankIcon = "";
            if (index === 0 && currentLearners > 0) rankIcon = "🥇 ";
            else if (index === 1 && currentLearners > 0) rankIcon = "🥈 ";
            else if (index === 2 && currentLearners > 0) rankIcon = "🥉 ";
            else rankIcon = `<span class="text-slate-300 font-bold ml-1 mr-2">${index + 1}.</span>`;

            return `
                <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 group cursor-pointer">
                    <div class="w-1/2 pr-2 flex items-center">
                        ${rankIcon}
                        <h4 class="text-[15px] text-slate-700 truncate group-hover:text-indigo-600 transition-colors" title="${set.title}">
                            ${set.title} 
                            <span class="text-xs text-slate-400 font-normal ml-1">(${currentLearners} người học)</span>
                        </h4>
                    </div>
                    <div class="w-1/3 flex items-center px-2">
                        <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full rounded-full ${colorClass} transition-all duration-1000" style="width: ${percent}%"></div>
                        </div>
                    </div>
                    <div class="w-12 text-right">
                        <span class="text-sm ${currentLearners === 0 ? 'text-slate-400 italic' : 'text-slate-600 font-medium'}">${percent}%</span>
                    </div>
                </div>
            `;
        }).join("");

        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-red-400 text-xs italic text-center mt-4">Lỗi kết nối máy chủ thống kê bộ thẻ!</p>`;
    }
};
