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
                        "vua dang nhap vao he thong.",
                        "login",
                        "text-green-500",
                        "bg-green-100"
                    );
                }

                alert("Login successful ! Hello " + data.username);
                location.reload();
                return;
            }

            alert(getErrorMessage(data, "Loi dang nhap!"));
        } catch (err) {
            alert("Loi ket noi Backend PHP! Coi lai XAMPP bat chua?");
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
        if (!usernameRegex.test(username)) return alert("Ten dang nhap phai tu 3 den 20 ky tu, viet lien khong dau va khong chua ky tu dac biet.");
        if (password.length < 6) return alert("Mat khau phai co it nhat 6 ky tu.");
        if (password !== confirmPassword) return alert("Hai mat khau khong khop. Nhap lai giup minh nhe.");

        try {
            const response = await registerUser({ username, email, password });
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                alert("Dang ky thanh cong qua he thong PHP! Quay lai dang nhap thoi!");

                if (window.logSystemActivity) {
                    window.logSystemActivity(
                        "vua dang ky tai khoan moi thanh cong.",
                        "person_add",
                        "text-emerald-500",
                        "bg-emerald-100"
                    );
                }

                document.getElementById("showLoginBtn").click();
                document.getElementById("registerForm").reset();
                return;
            }

            alert("Loi: " + getErrorMessage(data, "Bi loi gi do roi!"));
        } catch (err) {
            alert("Loi ket noi Backend PHP! Coi lai XAMPP bat chua?");
        }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("quizlet_user");
        location.reload();
    });
}
