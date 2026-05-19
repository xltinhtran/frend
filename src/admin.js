// ==========================================
// QUẢN LÝ PHÂN QUYỀN VÀ TRANG ADMIN qua du
// ==========================================

window.applyRolePermissions = function() {
    const userDataStr = localStorage.getItem("quizlet_user");
    if (!userDataStr) return; 

    const user = JSON.parse(userDataStr);
    const currentRole = (user.role || "").trim().toLowerCase();
    
    const els = {
        studyArea: document.getElementById("studyArea"), 
        adminView: document.getElementById("adminView"),
        createBtn: document.getElementById("homeCreateSetBtn"), 
        adminBtn: document.getElementById("navAdminPanelBtn"),
        addCardBtn: document.getElementById("setViewAddCardBtn"), 
        deleteSetBtn: document.getElementById("setViewDeleteBtn"),
        bulkBtn: document.getElementById("bulkImportBtn"), 
        search: document.getElementById("editorSearchContainer"),
        reset: document.getElementById("quickActionReset"),
        due: document.getElementById("quickActionDue"), 
        random: document.getElementById("quickActionRandom")
    };

    if (els.studyArea) els.studyArea.classList.remove("hidden");
    if (els.adminView) els.adminView.classList.add("hidden");
    if (els.search) els.search.classList.add("hidden");
    
    // Ẩn mặc định các nút quản lý
    [els.createBtn, els.adminBtn, els.addCardBtn, els.deleteSetBtn, els.bulkBtn].forEach(el => el?.classList.add("hidden"));

    if (window.learnerObserver) {
        window.learnerObserver.disconnect();
        window.learnerObserver = null;
    }

    let styleEl = document.getElementById("role-style-fix");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "role-style-fix";
        document.head.appendChild(styleEl);
    }

    if (currentRole === "editor") {
        styleEl.innerHTML = ""; 
        [els.createBtn, els.addCardBtn, els.deleteSetBtn, els.bulkBtn, els.search].forEach(el => el?.classList.remove("hidden"));
        [els.reset, els.due, els.random].forEach(el => el?.classList.add("hidden"));

        document.querySelectorAll("button").forEach(btn => {
            const txt = btn.innerText.toLowerCase();
            if (["learn", "random", "reset", "review", "starred", "ngẫu nhiên", "đã học"].some(k => txt.includes(k))) {
                btn.classList.add("hidden");
            }
        });
    } else if (currentRole === "admin") {
        styleEl.innerHTML = ""; 
        if (els.studyArea) els.studyArea.classList.add("hidden");
        if (els.adminView) els.adminView.classList.remove("hidden");
        if (els.adminBtn) els.adminBtn.classList.remove("hidden");
        if (typeof window.loadAdminUsers === "function") window.loadAdminUsers();
    } else {
        styleEl.innerHTML = `
            [onclick*="edit"], [onclick*="delete"], [onclick*="Edit"], [onclick*="Delete"],
            .edit-btn, .delete-btn, .btn-edit, .btn-delete, .update-btn, .remove-btn { 
                display: none !important; 
                width: 0 !important;
                height: 0 !important;
                pointer-events: none !important;
            }
        `;

        const killForbiddenIcons = () => {
            document.querySelectorAll('button').forEach(btn => {
                const cls = btn.className.toLowerCase();
                const txt = btn.textContent.trim().toLowerCase();
                if (txt === 'edit' || txt === 'delete' || txt === 'mode_edit' || txt === 'delete_outline') {
                    btn.style.setProperty('display', 'none', 'important');
                    btn.remove();
                }
                if (cls.includes('edit') || cls.includes('delete') || cls.includes('trash')) {
                    btn.style.setProperty('display', 'none', 'important');
                    btn.remove();
                }
            });
            document.querySelectorAll('svg').forEach(svg => {
                const svgCls = (svg.getAttribute('class') || "").toLowerCase();
                if (svgCls.includes('edit') || svgCls.includes('trash') || svgCls.includes('delete') || svgCls.includes('pen')) {
                    const parent = svg.closest('button') || svg.closest('div');
                    if (parent) {
                        parent.style.setProperty('display', 'none', 'important');
                        parent.remove(); 
                    } else {
                        svg.style.display = 'none';
                    }
                }
            });
        };
        killForbiddenIcons(); 
        window.learnerObserver = new MutationObserver(killForbiddenIcons);
        window.learnerObserver.observe(document.body, { childList: true, subtree: true });
    }
};

window.navigateToAdminPanel = async function (e) {
    if (e) e.preventDefault();
    window.location.hash = "admin";
    document.getElementById("homeView")?.classList.add("hidden");
    document.getElementById("setView")?.classList.add("hidden");
    document.getElementById("learnView")?.classList.add("hidden");
    const adminView = document.getElementById("adminView");
    if (adminView) adminView.classList.remove("hidden");
    await window.loadAdminUsers();
};

// ==========================================
// HÀM CHO TRANG ADMIN DASHBOARD (BẢN REDESIGN)
// ==========================================

// Biến toàn cục lưu trữ danh sách user và thẻ
window.cachedAdminUsers = [];
window.totalSystemCards = 0; 

// HÀM TẢI DỮ LIỆU TỪ SERVER C#
window.loadAdminUsers = async function() {
    try {
        const res = await fetch("https://localhost:7077/api/Users");
        const users = await res.json();
        
        try {
            const setsRes = await fetch("https://localhost:7077/api/StudySets"); 
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
                    const statsRes = await fetch(`https://localhost:7077/api/StudyProgresses/user/${u.id}/stats`);
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
        
        // XỬ LÝ TAB ĐĂNG XUẤT
        const navLogoutBtn = document.getElementById("navLogoutBtn");
        if (navLogoutBtn && !navLogoutBtn.dataset.listener) {
            navLogoutBtn.addEventListener("click", () => {
                localStorage.removeItem("quizlet_user"); 
                window.location.reload(); 
            });
            navLogoutBtn.dataset.listener = "true";
        }

        if (searchInput && !searchInput.dataset.listener) {
            searchInput.addEventListener("input", () => window.renderAdminDashboard());
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
window.renderAdminDashboard = function() {
    if (!window.cachedAdminUsers.length) return;

    const searchInput = document.getElementById("adminRealSearchInput");
    const sortSelect = document.getElementById("adminSortLearnerSelect");
    const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const sortType = sortSelect ? sortSelect.value : "level-desc";

    const VIPUsers = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() !== "learner");
    let learners = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() === "learner");

    // BIỂU ĐỒ PHÂN BỔ (Tính theo Từ đã thuộc)
    const levelCounts = { "C2": 0, "C1": 0, "B2": 0, "B1": 0, "A2": 0, "A1": 0, "A0": 0 };
    learners.forEach(l => {
        const rank = getRankInfo(l.masteredWords || 0);
        levelCounts[rank.id]++;
    });
    
    const maxCount = Math.max(...Object.values(levelCounts), 1);
    const chartHtml = Object.keys(levelCounts).map(key => {
        const count = levelCounts[key];
        if (count === 0) return ""; 
        
        const rankInfo = [500, 350, 200, 100, 40, 10, 0].map(getRankInfo).find(r => r.id === key);
        const widthPct = (count / maxCount) * 100;
        
        return `
            <div class="flex items-center gap-4 text-sm">
                <div class="w-16 font-bold text-slate-600 text-right">${key}</div>
                <div class="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${rankInfo.barColor} transition-all duration-1000" style="width: ${widthPct}%"></div>
                </div>
                <div class="w-10 text-slate-500 font-medium">${count} hs</div>
            </div>
        `;
    }).join("");
    const adminLevelChart = document.getElementById("adminLevelChart");
    if(adminLevelChart) adminLevelChart.innerHTML = chartHtml || "<p class='text-slate-400 italic'>Chưa có dữ liệu học tập.</p>";

    // TOP 5 LEADERBOARD (Xếp hạng theo Từ đã thuộc)
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
            </div>
        `;
    }).join("");
    const adminTopLearners = document.getElementById("adminTopLearners");
    if(adminTopLearners) adminTopLearners.innerHTML = top5Html || "<p class='text-slate-400 italic'>Chưa có bảng xếp hạng.</p>";

    // TÌM KIẾM & RENDER BẢNG
    if (searchTerm) {
        learners = learners.filter(u => (u.username || "").toLowerCase().includes(searchTerm) || (u.email || "").toLowerCase().includes(searchTerm));
    }
    
    // ĐÃ FIX: Lọc và sắp xếp bảng theo Từ đã thuộc (masteredWords)
    if (sortType === "name-asc") {
        learners.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    } else if (sortType === "level-desc") {
        learners.sort((a, b) => (b.masteredWords || 0) - (a.masteredWords || 0));
    } else if (sortType === "level-asc") {
        learners.sort((a, b) => (a.masteredWords || 0) - (b.masteredWords || 0));
    }

    const getAvatar = (name) => (name ? name.substring(0, 2).toUpperCase() : "US");

    // Render Bảng VIP
    const staffTbody = document.getElementById("adminStaffTableBody");
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
                </tr>
            `;
        }).join("");
    }

    // Render Bảng Học Viên
    const learnerTbody = document.getElementById("user-table-body");
    if (learnerTbody) {
        learnerTbody.innerHTML = learners.map((u, i) => {
            // ĐÃ FIX: Rank trong bảng học viên cũng tính bằng từ đã thuộc
            const rank = getRankInfo(u.masteredWords || 0);
            
            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-500">${i + 1}</td>
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
                </tr>
            `;
        }).join("");
        
        if (learners.length === 0) learnerTbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Không tìm thấy học viên!</td></tr>`;
    }
};

window.deleteUser = async function(id) {
    if (!confirm("Chắc chắn xóa vĩnh viễn user này?")) return;
    try {
        const res = await fetch(`https://localhost:7077/api/Users/${id}`, { method: "DELETE" });
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
        const response = await fetch(`https://localhost:7077/api/StudyProgresses/user/${userId}/stats`);
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

// ==========================================
// TÍNH NĂNG XUẤT BÁO CÁO RA FILE EXCEL (CSV)
// ==========================================
window.downloadCSVFile = function(csvContent, fileName) {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportUsersToCSV = function() {
    if (!window.cachedAdminUsers || window.cachedAdminUsers.length === 0) {
        alert("Dữ liệu hệ thống đang tải, vui lòng bấm Tải lại trang!");
        return;
    }

    const learners = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() === "learner");
    
    let csvContent = "STT,Tài khoản,Email,Vai trò,Từ đã thuộc,Đang ôn tập,Tổng từ đã học,Xếp hạng năng lực (CEFR)\n";
    
    learners.forEach((u, index) => {
        // ĐÃ FIX: Cột Xếp hạng trong file Excel cũng tính bằng Từ Đã Thuộc
        const rankLabel = getRankInfo(u.masteredWords || 0).label;
        const row = [
            index + 1,
            u.username || "N/A",
            u.email || "N/A",
            u.role || "Learner",
            u.masteredWords || 0,
            u.learningWords || 0,
            u.totalLearned || 0,
            rankLabel
        ];
        csvContent += row.map(val => `"${val}"`).join(",") + "\n";
    });

    const today = new Date().toISOString().slice(0, 10);
    window.downloadCSVFile(csvContent, `Bao_Cao_Tien_Do_Hoc_Vien_${today}.csv`);
};

window.exportStaffToCSV = function() {
    if (!window.cachedAdminUsers || window.cachedAdminUsers.length === 0) return;

    const staff = window.cachedAdminUsers.filter(u => (u.role || "").toLowerCase() !== "learner");
    
    let csvContent = "STT,Tài khoản,Email,Chức vụ điều hành\n";
    
    staff.forEach((u, index) => {
        const row = [
            index + 1,
            u.username || "N/A",
            u.email || "N/A",
            u.role || "Staff"
        ];
        csvContent += row.map(val => `"${val}"`).join(",") + "\n";
    });

    const today = new Date().toISOString().slice(0, 10);
    window.downloadCSVFile(csvContent, `Danh_Sach_Nhan_Su_He_Thong_${today}.csv`);
};