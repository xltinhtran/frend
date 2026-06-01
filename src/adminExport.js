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