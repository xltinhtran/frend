import { deleteUserById, getAllStudySets, getUserStats, getUsers } from "./api.js";

// ==========================================
// HÀM CHO TRANG ADMIN DASHBOARD (BẢN REDESIGN)
// ==========================================

// Biến toàn cục lưu trữ danh sách user và thẻ
window.cachedAdminUsers = [];
window.totalSystemCards = 0; 

// HÀM TẢI DỮ LIỆU TỪ SERVER C#
window.loadAdminUsers = async function() {
    try {
        const users = await getUsers();
        
        try {
            const setsRes = await getAllStudySets(); 
            if (setsRes.ok) {
                const allSets = await setsRes.json();
                window.totalSystemCards = allSets.reduce((sum, set) => sum + (set.flashcards ? set.flashcards.length : 0), 0);
            }
        } catch (e) { console.error("Lỗi đếm tổng thẻ:", e); }

        let totalLearnersCount = 0;
        let totalMasteredCount = 0;
        let totalLearningCount = 0;
        
        window.cachedAdminUsers = await Promise.all(users.map(async (u) => {
            if ((u.role || "").toLowerCase() === "learner") {
                totalLearnersCount++;
                try {
                    const statsRes = await getUserStats(u.id);
                    if (statsRes.ok) {
                        const data = await statsRes.json();
                        u.masteredWords = data.masteredWords || 0;
                        u.learningWords = data.learningWords || 0;
                        u.totalLearned = u.masteredWords + u.learningWords;
                        
                        totalMasteredCount += u.masteredWords;
                        totalLearningCount += u.learningWords;
                    } else {
                        u.masteredWords = 0; u.learningWords = 0; u.totalLearned = 0;
                    }
                } catch (e) {
                    u.masteredWords = 0; u.learningWords = 0; u.totalLearned = 0;
                }
            } else {
                u.totalLearned = -1; // Đánh dấu VIP
            }
            return u;
        }));

        // Bơm số liệu vào 4 thẻ KPI
        const elTotalLearners = document.getElementById("kpiTotalLearners");
        const elTotalMastered = document.getElementById("kpiTotalMastered");
        const elTotalLearning = document.getElementById("kpiTotalLearning");
        const elTotalCards = document.getElementById("kpiTotalCards");
        
        // CÔNG THỨC MỚI: Tính trung bình
        let avgMastered = totalLearnersCount > 0 ? Math.round(totalMasteredCount / totalLearnersCount) : 0;
        let avgLearning = totalLearnersCount > 0 ? Math.round(totalLearningCount / totalLearnersCount) : 0;

        if(elTotalLearners) elTotalLearners.innerText = totalLearnersCount;
        
        // Gắn thêm chữ "/người" cho nó trực quan
        if(elTotalMastered) elTotalMastered.innerHTML = `${avgMastered} <span class="text-lg text-slate-500 font-medium">/người</span>`;
        if(elTotalLearning) elTotalLearning.innerHTML = `${avgLearning} <span class="text-lg text-slate-500 font-medium">/người</span>`;
        
        if(elTotalCards) elTotalCards.innerText = window.totalSystemCards;

        // Gắn sự kiện 1 lần cho thanh công cụ
        const searchInput = document.getElementById("adminRealSearchInput");
        const sortSelect = document.getElementById("adminSortLearnerSelect");
        const exitBtn = document.getElementById("exitAdminBtn");
        // XỬ LÝ LỌC HOẠT ĐỘNG THEO NGÀY
        const logDateFilter = document.getElementById("logDateFilter");
        if (logDateFilter && !logDateFilter.dataset.listener) {
            logDateFilter.addEventListener("change", (e) => {
                const selectedDate = e.target.value; // Trả ra chuỗi định dạng YYYY-MM-DD
                window.renderActivityLog(selectedDate); // Kích hoạt kéo data ngày đó về
            });
            logDateFilter.dataset.listener = "true";
        }
        
        // XỬ LÝ TAB ĐĂNG XUẤT
        const navLogoutBtn = document.getElementById("navLogoutBtn");
        if (navLogoutBtn && !navLogoutBtn.dataset.listener) {
            navLogoutBtn.addEventListener("click", () => {
                localStorage.removeItem("quizlet_user"); 
                window.location.reload(); 
            });
            navLogoutBtn.dataset.listener = "true";
        }

      // TRONG HÀM window.loadAdminUsers
        if (searchInput && !searchInput.dataset.listener) {
            searchInput.addEventListener("input", () => {
                window.currentLearnerPage = 1; // BẤM TÌM KIẾM LÀ TỰ RESET VỀ TRANG 1
                window.renderAdminDashboard();
            });
            searchInput.dataset.listener = "true";
        }
        if (sortSelect && !sortSelect.dataset.listener) {
            sortSelect.addEventListener("change", () => window.renderAdminDashboard());
            sortSelect.dataset.listener = "true";
        }
        if (exitBtn && !exitBtn.dataset.listener) {
            exitBtn.addEventListener("click", () => {
                localStorage.removeItem("quizlet_user");
                window.location.reload(); 
            });
            exitBtn.dataset.listener = "true";
        }
        
        // Render nội dung
        window.renderAdminDashboard();

    } catch (err) {
        console.error("Lỗi lấy danh sách User:", err);
    }
};

// HÀM ĐỔI TAB GIAO DIỆN BÊN TRÁI
window.switchAdminView = function(viewId, btnElement) {
    document.querySelectorAll('.admin-view').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('flex');
    });
    
    const activeView = document.getElementById(viewId);
    if(activeView) {
        activeView.classList.remove('hidden');
        activeView.classList.add('flex');
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors";
    });

    if(btnElement) {
        btnElement.className = "nav-btn w-full flex items-center gap-3 px-4 py-3 text-indigo-700 bg-indigo-50 rounded-xl font-bold transition-colors";
    }

    const topbarTitle = document.getElementById('adminTopbarTitle');
    if (topbarTitle) {
        if(viewId === 'view-dashboard') topbarTitle.innerText = 'Dashboard Tổng Quan';
        if(viewId === 'view-users') topbarTitle.innerText = 'Quản Lý Người Dùng';
        if(viewId === 'view-reports') topbarTitle.innerText = 'Báo Cáo & Thống Kê';
    }
};

function getRankInfo(total) {
    if (total >= 500) return { id: "C2", label: "C2 - Chuyên Gia", badge: "👑 C2", color: "bg-yellow-100 text-yellow-800 border-yellow-200", barColor: "bg-yellow-500" };
    if (total >= 350) return { id: "C1", label: "C1 - Cao Cấp", badge: "💎 C1", color: "bg-purple-100 text-purple-800 border-purple-200", barColor: "bg-purple-500" };
    if (total >= 200) return { id: "B2", label: "B2 - Trung Cao", badge: "🚀 B2", color: "bg-blue-100 text-blue-800 border-blue-200", barColor: "bg-blue-500" };
    if (total >= 100) return { id: "B1", label: "B1 - Trung Cấp", badge: "🏃 B1", color: "bg-cyan-100 text-cyan-800 border-cyan-200", barColor: "bg-cyan-500" };
    if (total >= 40)  return { id: "A2", label: "A2 - Sơ Trung", badge: "🚶 A2", color: "bg-green-100 text-green-800 border-green-200", barColor: "bg-green-500" };
    if (total >= 10)  return { id: "A1", label: "A1 - Nhập Môn", badge: "👶 A1", color: "bg-orange-100 text-orange-800 border-orange-200", barColor: "bg-orange-500" };
    return { id: "A0", label: "Mới Học", badge: "🌱 Mới", color: "bg-slate-100 text-slate-700 border-slate-200", barColor: "bg-slate-400" };
}

// HÀM RENDER TỔNG HỢP: BIỂU ĐỒ, TOP 5 VÀ 2 BẢNG DANH SÁCH
// ==========================================
// CẤU HÌNH PHÂN TRANG (MỚI)
// ==========================================
window.currentLearnerPage = 1;
window.learnersPerPage = 5; // Ông thích hiển thị bao nhiêu người 1 trang thì sửa số này nhé

window.changeLearnerPage = function(page) {
    window.currentLearnerPage = page;
    window.renderAdminDashboard();
};

// ==========================================
// HÀM RENDER TỔNG HỢP (ĐÃ NÂNG CẤP PHÂN TRANG)
// ==========================================
window.renderAdminDashboard = function() {
    if (!window.cachedAdminUsers.length) return;

    const searchInput = document.getElementById("adminRealSearchInput");
    const sortSelect = document.getElementById("adminSortLearnerSelect");
    const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const sortType = sortSelect ? sortSelect.value : "level-desc";

    const VIPUsers = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() !== "learner");
    let learners = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() === "learner");

    // 1. BIỂU ĐỒ PHÂN BỔ & TOP 5 (Giữ nguyên logic cũ của ông)
    const levelCounts = { "C2": 0, "C1": 0, "B2": 0, "B1": 0, "A2": 0, "A1": 0, "A0": 0 };
    learners.forEach(l => { levelCounts[getRankInfo(l.masteredWords || 0).id]++; });
    const maxCount = Math.max(...Object.values(levelCounts), 1);
    
    const chartHtml = Object.keys(levelCounts).map(key => {
        const count = levelCounts[key];
        if (count === 0) return ""; 
        const rankInfo = [500, 350, 200, 100, 40, 10, 0].map(getRankInfo).find(r => r.id === key);
        return `
            <div class="flex items-center gap-4 text-sm">
                <div class="w-16 font-bold text-slate-600 text-right">${key}</div>
                <div class="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${rankInfo.barColor} transition-all duration-1000" style="width: ${(count / maxCount) * 100}%"></div>
                </div>
                <div class="w-10 text-slate-500 font-medium">${count} hs</div>
            </div>`;
    }).join("");
    const adminLevelChart = document.getElementById("adminLevelChart");
    if(adminLevelChart) adminLevelChart.innerHTML = chartHtml || "<p class='text-slate-400 italic'>Chưa có dữ liệu học tập.</p>";

    const top5Learners = [...learners].sort((a, b) => (b.masteredWords || 0) - (a.masteredWords || 0)).slice(0, 5);
    const top5Html = top5Learners.map((u, i) => {
        const rank = getRankInfo(u.masteredWords || 0);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
        return `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="flex items-center gap-3">
                    <div class="text-2xl">${medal}</div>
                    <div>
                        <div class="font-bold text-slate-800">${u.username}</div>
                        <div class="text-xs text-slate-500">${u.masteredWords || 0} từ đã thuộc</div>
                    </div>
                </div>
                <span class="px-2 py-1 rounded-lg text-xs font-bold border ${rank.color}">${rank.badge}</span>
            </div>`;
    }).join("");
    const adminTopLearners = document.getElementById("adminTopLearners");
    if(adminTopLearners) adminTopLearners.innerHTML = top5Html || "<p class='text-slate-400 italic'>Chưa có bảng xếp hạng.</p>";

    // 2. TÌM KIẾM & SẮP XẾP HỌC VIÊN
    if (searchTerm) {
        learners = learners.filter(u => (u.username || "").toLowerCase().includes(searchTerm) || (u.email || "").toLowerCase().includes(searchTerm));
    }
    
    if (sortType === "name-asc") learners.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    else if (sortType === "level-desc") learners.sort((a, b) => (b.masteredWords || 0) - (a.masteredWords || 0));
    else if (sortType === "level-asc") learners.sort((a, b) => (a.masteredWords || 0) - (b.masteredWords || 0));

    // ==========================================
    // 3. LOGIC CẮT MẢNG ĐỂ PHÂN TRANG Ở ĐÂY
    // ==========================================
    const totalLearners = learners.length;
    const totalPages = Math.ceil(totalLearners / window.learnersPerPage) || 1;

    // Ép trang hiện tại không được lố quá tổng số trang
    if (window.currentLearnerPage > totalPages) window.currentLearnerPage = totalPages;
    if (window.currentLearnerPage < 1) window.currentLearnerPage = 1;

    const startIndex = (window.currentLearnerPage - 1) * window.learnersPerPage;
    const endIndex = startIndex + window.learnersPerPage;
    const paginatedLearners = learners.slice(startIndex, endIndex); // Lấy đúng số người của trang hiện tại

    // 4. RENDER BẢNG VIP
    const staffTbody = document.getElementById("adminStaffTableBody");
    const getAvatar = (name) => (name ? name.substring(0, 2).toUpperCase() : "US");
    if (staffTbody) {
        staffTbody.innerHTML = VIPUsers.map((u, i) => {
            const role = (u.role || "").toLowerCase();
            const badge = role === "admin" ? `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Admin</span>` : `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Editor</span>`;
            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-6 py-4 font-bold text-slate-400">${i + 1}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">${getAvatar(u.username)}</div>
                            <div>
                                <div class="font-bold text-slate-800">${u.username}</div>
                                <div class="text-xs text-slate-500">${u.email || "N/A"}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">${badge}</td>
                    <td class="px-6 py-4 text-right">
                        ${role === "admin" ? '<span class="text-slate-400 text-sm">Protected</span>' : `<button onclick="window.deleteUser(${u.id})" class="text-red-500 hover:text-red-700 text-sm font-semibold">Xóa quyền</button>`}
                    </td>
                </tr>`;
        }).join("");
    }

    // 5. RENDER BẢNG HỌC VIÊN (Vẽ danh sách đã bị cắt)
    const learnerTbody = document.getElementById("user-table-body");
    if (learnerTbody) {
        learnerTbody.innerHTML = paginatedLearners.map((u, i) => {
            const rank = getRankInfo(u.masteredWords || 0);
            const realSTT = startIndex + i + 1; // STT hiển thị đúng số thứ tự tuyệt đối
            
            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-500">${realSTT}</td>
                    <td class="px-6 py-4 font-semibold text-slate-800">${u.username}</td>
                    <td class="px-6 py-4 font-medium text-slate-500">${u.email || "N/A"}</td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 rounded-lg text-xs font-bold border ${rank.color}">${rank.badge}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-4">
                            <button onclick="window.viewUserProgress(${u.id}, '${u.username}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">Xem tiến độ</button>
                            <button onclick="window.deleteUser(${u.id})" class="text-red-500 hover:text-red-700 font-bold text-sm transition-colors">Xóa</button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
        
        if (learners.length === 0) learnerTbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Không tìm thấy học viên!</td></tr>`;
    }

    // 6. RENDER GIAO DIỆN NÚT PHÂN TRANG (Dưới đáy bảng)
    const paginationContainer = document.getElementById("learnerPagination");
    if (paginationContainer) {
        if (totalLearners === 0) {
            paginationContainer.innerHTML = "";
            return;
        }

        let pageButtons = "";
        for (let p = 1; p <= totalPages; p++) {
            pageButtons += `<button onclick="window.changeLearnerPage(${p})" class="px-3 py-1.5 text-sm rounded-lg ${p === window.currentLearnerPage ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100 font-medium'} mx-1 transition-colors">${p}</button>`;
        }

        paginationContainer.innerHTML = `
            <div class="flex justify-center w-full">
                <div class="flex items-center border border-slate-200 rounded-lg p-1">
                 <button onclick="window.changeLearnerPage(${window.currentLearnerPage - 1})" class="px-2 py-1.5 text-slate-500 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" ${window.currentLearnerPage === 1 ? 'disabled' : ''}>
                    <span class="material-symbols-outlined text-sm font-bold">arrow_back_ios_new</span>
                 </button>
            
                    ${pageButtons}
            
                  <button onclick="window.changeLearnerPage(${window.currentLearnerPage + 1})" class="px-2 py-1.5 text-slate-500 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors" ${window.currentLearnerPage === totalPages ? 'disabled' : ''}>
                      <span class="material-symbols-outlined text-sm font-bold">arrow_forward_ios</span>
                  </button>
                  </div>
            </div>
        `;
    }
};

window.deleteUser = async function(id) {
    if (!confirm("Chắc chắn xóa vĩnh viễn user này?")) return;
    try {
        const res = await deleteUserById(id);
        if (res.ok) {
            alert("Xóa thành công!");
            window.loadAdminUsers(); // Tải lại toàn bộ Dashboard
        }
    } catch (err) { console.error(err); }
};

// ==========================================
// HÀM BẬT POPUP XEM TIẾN ĐỘ
// ==========================================
window.viewUserProgress = async function(userId, username) {
    try {
        const response = await getUserStats(userId);
        if (!response.ok) throw new Error("Lỗi API Thống kê");
        const data = await response.json();
        
        const totalWordsInDB = window.totalSystemCards || 0; 
        const mastered = data.masteredWords || 0;
        const learning = data.learningWords || 0;
        const totalLearnedForRank = mastered + learning; 
        
        let remaining = totalWordsInDB - totalLearnedForRank;
        if (remaining < 0) remaining = 0; 
        
        // ĐÃ FIX: Popup modal xét hạng bằng Từ Đã Thuộc
        const rank = getRankInfo(mastered);

        // Đổ dữ liệu vào Modal
        document.getElementById("progressUserName").innerText = `Tiến độ của: ${username}`;
        document.getElementById("progLevel").innerHTML = `<span class="px-3 py-1 rounded-lg text-sm font-bold border ${rank.color}">${rank.badge}</span>`;
        document.getElementById("progMastered").innerText = `${mastered} từ`;
        document.getElementById("progLearning").innerText = `${learning} từ`;
        document.getElementById("progRemaining").innerText = `${remaining} từ`;
        document.getElementById("progTotal").innerText = `${totalWordsInDB} từ`;
        
        // Bật Modal
        const modal = document.getElementById("progressModal");
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    } catch (err) {
        alert("Lỗi tải tiến độ! Hoặc user này chưa học từ nào!");
        console.error(err);
    }
};
