// auth.js
export function setupAuthListeners() {
    document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("loginUsername").value;
        const password = document.getElementById("loginPassword").value;
        try {
            const response = await fetch("http://localhost/quizlet_api/login.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                // 1. Lưu session đăng nhập
                localStorage.setItem("quizlet_user", JSON.stringify(data));
                
                // 2. 🔥 BẮN LOG HOẠT ĐỘNG LÊN DATABASE Ở ĐÂY 🔥
                if (window.logSystemActivity) {
                    window.logSystemActivity(
                        "vừa đăng nhập vào hệ thống.", 
                        "login", 
                        "text-green-500", 
                        "bg-green-100"
                    );
                }

                // 3. Thông báo và tải lại trang
                alert("Login successful ! Hello " + data.username);
                location.reload();
            } else {
                alert(data.message || "Lỗi đăng nhập!");
            }
        } catch (err) {
            alert("Lỗi kết nối Backend PHP! Coi lại XAMPP bật chưa?");
        }
    });
    
    // ... (Các phần code bên dưới của form Register ông cứ giữ nguyên nhé)
    document.getElementById("showRegisterBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("loginForm").classList.add("hidden");
        document.getElementById("registerForm").classList.remove("hidden");
        const modalTitle = document.querySelector("#loginModal h2");
        if (modalTitle) modalTitle.innerText = "Register for an account now!";
    });

    document.getElementById("showLoginBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("registerForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");
        const modalTitle = document.querySelector("#loginModal h2");
        if (modalTitle) modalTitle.innerText = "Welcome to the website!";
    });

    document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("regUsername").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("regConfirmPassword").value;

        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) return alert("Tên đăng nhập phải từ 3 đến 20 ký tự, viết liền không dấu và không chứa ký tự đặc biệt nha ní!");
        if (password.length < 6) return alert("Mật khẩu gì mà ngắn ngủn vậy! Đặt ít nhất 6 ký tự cho nó an toàn nhé!");
        if (password !== confirmPassword) return alert("Ê ní ơi, 2 cái mật khẩu nó đấm nhau kìa! Nhập lại cho giống nhau nha!");

        try {
            const response = await fetch("http://localhost/quizlet_api/register.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, passwordHash: password, role: "Learner" }),
            });
            if (response.ok) {
                alert("Đăng ký thành công qua hệ thống PHP! Quay lại đăng nhập thôi!");
                
                // 🔥 LOG ĐĂNG KÝ
                if (window.logSystemActivity) window.logSystemActivity("vừa đăng ký tài khoản mới thành công.", "person_add", "text-emerald-500", "bg-emerald-100");
                
                document.getElementById("showLoginBtn").click();
                document.getElementById("registerForm").reset();
            } else {
                const data = await response.json();
                alert("Lỗi: " + (data.message || "Bị lỗi gì đó rồi!"));
            }
        } catch (err) {
            alert("Lỗi kết nối Backend PHP! Coi lại XAMPP bật chưa?");
        }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("quizlet_user");
        location.reload();
    });
}