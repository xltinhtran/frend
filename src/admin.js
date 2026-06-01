import "./adminAuth.js";
import "./adminDashboard.js";
import "./adminExport.js";
import "./adminLogs.js";
import "./adminSets.js";

// 🔥 SỬA LỖI Ở ĐÂY: GỌI HÀM KHI LOAD DASHBOARD 🔥
const originalRenderDashboardUI = window.renderAdminDashboard;
window.renderAdminDashboard = function() {
    if (originalRenderDashboardUI) originalRenderDashboardUI();
    if (window.renderActivityLog) window.renderActivityLog(); 
    if (window.renderPopularSets) window.renderPopularSets(); // <-- Nãy ông thiếu cái dòng quan trọng này nên nó không nạp data đó!
};