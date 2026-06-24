// auth.js
import { loginUser, registerUser } from "./api.js";

function getErrorMessage(data, fallback) {
    return data?.message || fallback;
}

export function setupAuthListeners() {
    document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("loginUsername").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await loginUser(username, password);
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("quizlet_user", JSON.stringify(data));

                if (window.logSystemActivity) {
                    window.logSystemActivity(
                        "vừa đăng nhập vào hệ thống.",
                        "login",
                        "text-green-500",
                        "bg-green-100"
                    );
                }

                alert("Đăng nhập thành công! Xin chào " + data.username);
                location.reload();
                return;
            }

            alert(getErrorMessage(data, "Lỗi đăng nhập!"));
        } catch (err) {
            alert("Lỗi kết nối Backend C#! Kiểm tra API https://localhost:7077 đã chạy chưa.");
        }
    });

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
        if (!usernameRegex.test(username)) return alert("Tên đăng nhập phải từ 3 đến 20 ký tự, viết liền không dấu và không chứa ký tự đặc biệt.");
        if (password.length < 6) return alert("Mật khẩu phải có ít nhất 6 ký tự.");
        if (password !== confirmPassword) return alert("Hai mật khẩu không khớp. Nhập lại giúp mình nhé.");

        try {
            const response = await registerUser({ username, email, password });
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                alert("Đăng ký thành công qua Backend C#! Quay lại đăng nhập thôi!");

                if (window.logSystemActivity) {
                    window.logSystemActivity(
                        "vừa đăng ký tài khoản mới thành công.",
                        "person_add",
                        "text-emerald-500",
                        "bg-emerald-100"
                    );
                }

                document.getElementById("showLoginBtn").click();
                document.getElementById("registerForm").reset();
                return;
            }

            alert("Lỗi: " + getErrorMessage(data, "Đăng ký thất bại!"));
        } catch (err) {
            alert("Lỗi kết nối Backend C#! Kiểm tra API https://localhost:7077 đã chạy chưa.");
        }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("quizlet_user");
        location.reload();
    });
}
