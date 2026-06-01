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
    [els.createBtn, els.addCardBtn, els.deleteSetBtn, els.bulkBtn].forEach(el => el?.classList.add("hidden"));

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