// ==========================================
// QUẢN LÝ PHÂN QUYỀN VÀ TRANG ADMIN
// ==========================================

window.applyRolePermissions = function() {
    const userDataStr = localStorage.getItem("quizlet_user");
    if (!userDataStr) return; 

    const user = JSON.parse(userDataStr);
    const currentRole = (user.role || "").trim().toLowerCase();
    
    // 1. Cập nhật thêm 2 nút Cam và Tím vào đây
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
        // Thêm 2 "thủ phạm" này vào:
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
        // Editor được hiện các nút tạo/sửa
        [els.createBtn, els.addCardBtn, els.deleteSetBtn, els.bulkBtn, els.search].forEach(el => el?.classList.remove("hidden"));
        
        // 🔥 ĐUỔI KHỨ ĐOẠN NÀY: Ẩn sạch 3 nút tính năng học tập
        [els.reset, els.due, els.random].forEach(el => el?.classList.add("hidden"));

        // Quét thêm lần nữa theo nội dung để chắc chắn
        document.querySelectorAll("button").forEach(btn => {
            const txt = btn.innerText.toLowerCase();
            // Nếu nút chứa các từ khóa học tập thì cho bay màu
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
        // ... (Phần code Learner giữ nguyên vì ông viết "Sát thủ" quá chuẩn rồi)
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
    await loadAdminUsers();
};

// ==========================================
// HÀM CHO TRANG ADMIN (QUẢN LÝ USER)
// ==========================================
window.loadAdminUsers = async function() {
    try {
        const res = await fetch("https://localhost:7077/api/Users");
        const users = await res.json();
        const tbody = document.getElementById("adminUserTableBody");
        if (!tbody) return;

        tbody.innerHTML = users.map(u => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="px-6 py-4 text-slate-600">${u.id}</td>
                <td class="px-6 py-4 font-medium text-slate-800">${u.username}</td>
                <td class="px-6 py-4 text-slate-600">${u.email || "N/A"}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-bold ${
                        u.role === "Admin" ? "bg-red-100 text-red-700" : 
                        (u.role === "Editor" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")
                    }">${u.role}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${u.role === "Admin" ? '<span class="text-slate-400 text-sm italic">Cannot be deleted</span>' : 
                    `<div class="flex items-center justify-end gap-3">
                        ${u.role === "Learner" ? `<button onclick="window.viewUserProgress(${u.id}, '${u.username}')" class="text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors">Progress</button>` : ''}
                        <button onclick="window.deleteUser(${u.id})" class="text-red-500 hover:text-red-700 font-semibold text-sm transition-colors">Delete User</button>
                    </div>`}
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Lỗi lấy danh sách User:", err);
    }
};

window.deleteUser = async function(id) {
    if (!confirm("Ông có chắc muốn xóa vĩnh viễn thằng User này không? Cả tiến độ học của nó cũng bay luôn đó!")) return;
    try {
        const res = await fetch(`https://localhost:7077/api/Users/${id}`, { method: "DELETE" });
        if (res.ok) {
            alert("Đã tiễn nó ra đảo thành công!");
            window.loadAdminUsers();
        } else {
            alert("Xóa thất bại!");
        }
    } catch (err) {
        console.error("Lỗi xóa user:", err);
    }
};

// 🔥 HÀM XEM TIẾN ĐỘ (ĐÃ TÍCH HỢP LÁCH LUẬT LÊN RANK)
window.viewUserProgress = async function(userId, username) {
    try {
        const response = await fetch(`https://localhost:7077/api/StudyProgresses/user/${userId}/stats`);
        if (!response.ok) throw new Error("Lỗi API Thống kê");
        const data = await response.json();
        
        let totalWordsInDB = 0;
        try {
            const setsRes = await fetch("https://localhost:7077/api/StudySets"); 
            if (setsRes.ok) {
                const allSets = await setsRes.json();
                allSets.forEach(set => {
                    if (set.flashcards && set.flashcards.length > 0) totalWordsInDB += set.flashcards.length;
                });
            }
        } catch (e) {
            console.error("Lỗi khi đếm tổng số từ:", e);
        }
        
        const mastered = data.masteredWords || 0;
        const learning = data.learningWords || 0;
        // LÁCH LUẬT: Cộng dồn cả Đang học và Đã thuộc
        const totalLearnedForRank = mastered + learning; 
        
        let remaining = totalWordsInDB - totalLearnedForRank;
        if (remaining < 0) remaining = 0; 
        
        let level = "Mới Bắt Đầu 🌱";
        let levelColor = "text-slate-600 bg-slate-100 border-slate-200";

        if (totalLearnedForRank >= 500) {
            level = "C2 - Chuyên Gia 👑";
            levelColor = "text-yellow-700 bg-yellow-100 border-yellow-300";
        } else if (totalLearnedForRank >= 350) {
            level = "C1 - Cao Cấp 💎";
            levelColor = "text-purple-700 bg-purple-100 border-purple-300";
        } else if (totalLearnedForRank >= 200) {
            level = "B2 - Trung Cao Cấp 🚀";
            levelColor = "text-blue-700 bg-blue-100 border-blue-300";
        } else if (totalLearnedForRank >= 100) {
            level = "B1 - Trung Cấp 🏃";
            levelColor = "text-cyan-700 bg-cyan-100 border-cyan-300";
        } else if (totalLearnedForRank >= 40) {
            level = "A2 - Sơ Trung Cấp 🚶";
            levelColor = "text-green-700 bg-green-100 border-green-300";
        } else if (totalLearnedForRank >= 10) {
            level = "A1 - Nhập Môn 👶";
            levelColor = "text-orange-700 bg-orange-100 border-orange-300";
        }

        document.getElementById("progressUserName").innerText = `Tiến độ của: ${username}`;
        
        const progLevelEl = document.getElementById("progLevel");
        if (progLevelEl) {
            progLevelEl.innerText = level;
            progLevelEl.className = `text-lg font-bold px-3 py-1 rounded-lg border shadow-sm ${levelColor}`;
        }

        document.getElementById("progMastered").innerText = mastered;
        document.getElementById("progLearning").innerText = learning;
        
        const progTotalEl = document.getElementById("progTotal");
        if (progTotalEl) progTotalEl.innerText = totalWordsInDB;

        const progRemainingEl = document.getElementById("progRemaining");
        if (progRemainingEl) progRemainingEl.innerText = remaining;
        
        document.getElementById("progressModal").classList.remove("hidden");
    } catch (err) {
        alert("Lỗi! Hoặc user này chưa học từ nào!");
        console.error(err);
    }
};