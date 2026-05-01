// Storage and Database 
const STORAGE_KEY = 'ipt_demo_v1';
const API_BASE_URL = 'http://localhost:4000';

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            window.db = JSON.parse(stored);
        } else {
            window.db = {
                accounts: [
                    { 
                      firstName: 'Admin', 
                      lastName: 'User',   
                      email: 'admin@example.com', 
                      password: 'Password123!', 
                      verified: true, role: 'admin' }
                ],
                departments: [
                    { name: 'Engineering' },
                    { name: 'HR' }
                ],
                requests: []
            };
            saveToStorage();
        }

        window.db.requests = window.db.requests || [];
        window.db.employees = window.db.employees || [];
    } catch (error) {
        console.error("Failed to load DB, resetting.", error);
        window.db = {
            accounts: [
                { 
                  firstName: 'Admin', 
                  lastName: 'User', 
                  email: 'admin@gmail.com', 
                  password: 'admin123', 
                  verified: true, role: 'admin' }
            ],
            departments: [
                { name: 'Engineering' },
                { name: 'HR' }
            ],
            requests: []
        };
        saveToStorage();
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function toApiRole(role) {
    return role === 'admin' ? 'Admin' : 'User';
}

function fromApiRole(role) {
    return String(role || 'User').toLowerCase() === 'admin' ? 'admin' : 'user';
}

function mapApiUserToAccount(user, existingPassword = '') {
    return {
        id: user.id,
        title: user.title || 'Mr',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: (user.email || '').toLowerCase(),
        password: existingPassword,
        verified: true,
        role: fromApiRole(user.role)
    };
}

async function refreshAccountsFromApi() {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) {
        throw new Error('Failed to load users from API');
    }

    const users = await response.json();
    const passwordMap = new Map((window.db.accounts || []).map(acc => [acc.email, acc.password || '']));
    window.db.accounts = users.map(user => mapApiUserToAccount(user, passwordMap.get((user.email || '').toLowerCase()) || ''));
    saveToStorage();
}


// Routing  
function handleRouting() {
    const hash = window.location.hash || '#/home';
    const route = hash.replace('#/', '');

    const protectedRoutes = [
        'profile',
        'employees',
        'accounts',
        'departments',
        'adminRequests',
        'userRequests'
    ];

    if (protectedRoutes.includes(route) && !currentUser) {
        window.location.hash = '#/login';
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    const page = document.getElementById(route);
    if (page) {
        page.style.display = 'block';
    } else {
        document.getElementById('home').style.display = 'block';
    }

    if (hash === 'accounts' && currentUser?.role !== 'admin') {
    window.location.hash = '#/home';
    showToast("Access denied.", "danger");
    return;
    }

    if (route === 'profile') renderProfile();
    if (route === 'accounts') renderAccountsList();
    if (route === 'requests') renderRequestsTable();
    if (route === 'adminRequests') renderAdminRequests();
    if (route === 'employees') renderEmployeesTable();
    if (route === 'departments') renderDepartmentsTable();
    if (route === 'verifyemail') showVerifyEmail();
}
window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', handleRouting);


// Initialization
window.addEventListener('load', () => {
    loadFromStorage();

    const token = localStorage.getItem('auth_token');
    if (token) {
        const user = window.db.accounts.find(acc => acc.email === token);
        if (user) setAuthState(true, user);
        else setAuthState(false);
    } else {
        setAuthState(false);
    }

    if (!window.location.hash) window.location.hash = '#/home';
    handleRouting();

    refreshAccountsFromApi().catch((error) => {
        console.warn('API sync skipped. Using local data.', error);
    });
});


// Registration
function register() {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;

    if (!firstName || !lastName || !email || !password) {
        showToast("All fields are required.");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters.");
        return;
    }

    const existing = window.db.accounts.find(acc => acc.email === email);
    if (existing) {
        showToast("Email already registered.");
        return;
    }

    const newUser = { firstName, lastName, email, password, verified: false, role: 'user' };
    window.db.accounts.push(newUser);
    saveToStorage();
    localStorage.setItem('unverified_email', email);
    window.location.hash = '#/verifyemail';
}


// Email Verification
function simVerification() {
    const email = localStorage.getItem('unverified_email');
    if (!email) return showToast("No email found to verify.");

    const user = window.db.accounts.find(acc => acc.email === email);
    if (!user) return showToast("User not found.");

    user.verified = true;
    saveToStorage();
    localStorage.removeItem('unverified_email');
    showToast(`Email ${email} verified! You can now log in.`);
    window.location.hash = '#/login';
}

function showVerifyEmail() {
    const email = localStorage.getItem('unverified_email');
    const display = document.getElementById('verifyEmailDisplay');

    if (display && email) {
        display.textContent = email;
    }
}


// Log In
function loginUser() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    const user = window.db.accounts.find(acc => acc.email === email && acc.password === password && acc.verified);

    if (!user) {
        showToast("Invalid email/password or email not verified.");
        return;
    }

    localStorage.setItem('auth_token', user.email);
    setAuthState(true, user);
    window.location.hash = '#/profile';
    validateInput(emailInput, email !== "");
    validateInput(passwordInput, password.length >= 6);

}


// Authentication
function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;

    document.body.classList.toggle('authenticated', isAuth);
    document.body.classList.toggle('not-authenticated', !isAuth);
    document.body.classList.toggle('is-admin', isAuth && user?.role === 'admin');

    const roleLoggedOut = document.querySelector('.role-logged-out');
    const adminDropdown = document.getElementById('adminDropdownContainer');
    const userNavLink = document.getElementById('userNavLink');

    if (isAuth) {
        if (roleLoggedOut) roleLoggedOut.classList.add('d-none');

        if (user.role === 'admin') {
            if (adminDropdown) adminDropdown.classList.remove('d-none');
            if (userNavLink) userNavLink.classList.add('d-none');
        } else {
            if (userNavLink) userNavLink.classList.remove('d-none');
            if (adminDropdown) adminDropdown.classList.add('d-none');
        }
    } else {
        if (roleLoggedOut) roleLoggedOut.classList.remove('d-none');
        if (adminDropdown) adminDropdown.classList.add('d-none');
        if (userNavLink) userNavLink.classList.add('d-none');
    }
}

function validateInput(input, condition) {
    if (condition) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    } else {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
    }
}

// Profile
function renderProfile() {
    if (!currentUser) return;

    document.getElementById('profileName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        showToast("Edit Profile clicked! (Feature coming soon)");
    });
}

// Accounts (Admin)
function renderAccountsList() {
    const tbody = document.getElementById('accountsTableBody');
    tbody.innerHTML = '';

    window.db.accounts.forEach((acc, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${acc.firstName} ${acc.lastName}</td>
                <td>${acc.email}</td>
                <td>${acc.role}</td>
                <td>${acc.verified ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-outline-primary me-1" onclick="showEditForm(${i})">Edit</button>
                    <button class="btn btn-outline-warning me-1" onclick="resetPassword(${i})">Reset PW</button>
                    <button class="btn btn-outline-danger" onclick="deleteAccount(${i})">Delete</button>
                </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('addAccountBtn').classList.toggle('d-none', !currentUser || currentUser.role !== 'admin');
}

const addAccountBtn = document.getElementById('addAccountBtn');
const cancelNewAccountBtn = document.getElementById('cancelNewAccountBtn');
const saveNewAccountBtn = document.getElementById('saveNewAccountBtn');
const addFirstName = document.getElementById('addFirstName');
const addLastName  = document.getElementById('addLastName');
const addEmail     = document.getElementById('addEmail');
const addPassword  = document.getElementById('addPassword');
const addRole      = document.getElementById('addRole');
const addVerified  = document.getElementById('addVerified');
const accountsTableBody = document.getElementById('accountsTableBody');


const toggle = (id, show = true) => document.getElementById(id).style.display = show ? 'block' : 'none';

addAccountBtn.onclick = () => toggle('addAccountForm', true);
cancelNewAccountBtn.onclick = () => toggle('addAccountForm', false);

saveNewAccountBtn.onclick = async () => {
    const firstName = addFirstName.value.trim();
    const lastName  = addLastName.value.trim();
    const email     = addEmail.value.trim().toLowerCase();
    const password  = addPassword.value;
    const role      = addRole.value;
    const verified  = addVerified.checked;

    if (!firstName || !lastName || !email || !password)
        return showToast("All fields required");

    if (password.length < 6)
        return showToast("Password must be at least 6 characters");

    if (window.db.accounts.some(a => a.email === email))
        return showToast("Email already exists");

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Mr',
                firstName,
                lastName,
                role: toApiRole(role),
                email,
                password,
                confirmPassword: password
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to create user');
        }

        await refreshAccountsFromApi();
        renderAccountsList();
    } catch (error) {
        showToast(error.message || 'Cannot connect to API', 'danger');
        return;
    }

    addFirstName.value = '';
    addLastName.value  = '';
    addEmail.value     = '';
    addPassword.value  = '';
    addRole.value      = 'user';
    addVerified.checked = false;
    toggle('addAccountForm', false);
};

let editingAccountIndex = null;

function showEditForm(index) {
    editingAccountIndex = index;
    const acc = window.db.accounts[index];

    document.getElementById('editFirstName').value = acc.firstName;
    document.getElementById('editLastName').value = acc.lastName;
    document.getElementById('editEmail').value = acc.email;
    document.getElementById('editRole').value = acc.role;
    document.getElementById('editVerified').value = acc.verified ? 'true' : 'false';

    document.getElementById('editAccountForm').style.display = 'block';
}

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editingAccountIndex = null;
    document.getElementById('editAccountForm').style.display = 'none';
});

document.getElementById('saveAccountBtn').addEventListener('click', async () => {
    if (editingAccountIndex === null) return;

    const acc = window.db.accounts[editingAccountIndex];
    acc.firstName = document.getElementById('editFirstName').value.trim();
    acc.lastName = document.getElementById('editLastName').value.trim();
    acc.email = document.getElementById('editEmail').value.trim().toLowerCase();
    acc.role = document.getElementById('editRole').value;
    acc.verified = document.getElementById('editVerified').value === 'true';

    try {
        const response = await fetch(`${API_BASE_URL}/users/${acc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: acc.title || 'Mr',
                firstName: acc.firstName,
                lastName: acc.lastName,
                role: toApiRole(acc.role),
                email: acc.email
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to update user');
        }

        await refreshAccountsFromApi();
        editingAccountIndex = null;
        document.getElementById('editAccountForm').style.display = 'none';
        renderAccountsList();
    } catch (error) {
        showToast(error.message || 'Cannot connect to API', 'danger');
    }
});

let resettingAccountIndex = null;

function resetPassword(index) {
    resettingAccountIndex = index;
    const acc = window.db.accounts[index];

    document.getElementById('newPasswordInput').value = '';
    document.getElementById('resetPasswordForm').style.display = 'block';
}

document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
    resettingAccountIndex = null;
    document.getElementById('resetPasswordForm').style.display = 'none';
});

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    if (resettingAccountIndex === null) return;

    const newPassword = document.getElementById('newPasswordInput').value.trim();
    if (!newPassword || newPassword.length < 6) return showToast("Password must be at least 6 characters");

    const acc = window.db.accounts[resettingAccountIndex];

    try {
        const response = await fetch(`${API_BASE_URL}/users/${acc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: newPassword,
                confirmPassword: newPassword
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to reset password');
        }

        window.db.accounts[resettingAccountIndex].password = newPassword;
        saveToStorage();
        resettingAccountIndex = null;
        document.getElementById('resetPasswordForm').style.display = 'none';
        showToast("Password successfully updated!");
    } catch (error) {
        showToast(error.message || 'Cannot connect to API', 'danger');
    }
});

async function deleteAccount(index) {
    const acc = window.db.accounts[index];

    if (currentUser && acc.email === currentUser.email) {
        showToast("You cannot delete your own account.");
        return;
    }

    if (!confirm(`Are you sure you want to delete ${acc.firstName} ${acc.lastName}?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/users/${acc.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to delete user');
        }

        await refreshAccountsFromApi();
        renderAccountsList();
    } catch (error) {
        showToast(error.message || 'Cannot connect to API', 'danger');
    }
}



// Employees & Departments (Admin)
function renderEmployeesTable() {
    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = '';

    const employees = window.db.employees || [];
    employees.forEach((e, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${e.email || ''}</td>
            <td>${e.role || ''}</td>
            <td>${e.department || ''}</td>
            <td>
                <button class="btn btn-outline-primary" onclick="showToast('Edit Employee not implemented')">Edit</button>
                <button class="btn btn-outline-danger" onclick="showToast('Delete Employee not implemented')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('addEmployeeBtn').classList.toggle('d-none', !currentUser || currentUser.role !== 'admin');
}

const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const cancelNewEmployeeBtn = document.getElementById('cancelNewEmployeeBtn');
const saveNewEmployeeBtn = document.getElementById('saveNewEmployeeBtn');
const empEmail = document.getElementById('empEmail');
const empRole = document.getElementById('empRole');
const empDept = document.getElementById('empDept');
const empVerified = document.getElementById('empVerified');

addEmployeeBtn.onclick = () => toggle('addEmployeeForm', true);
cancelNewEmployeeBtn.onclick = () => toggle('addEmployeeForm', false);

saveNewEmployeeBtn.onclick = () => {
    const email = empEmail.value.trim().toLowerCase();
    const role = empRole.value;
    const department = empDept.value;

    if (!email || !role || !department)
        return showToast("All fields required");

    if (db.employees.some(e => e.email === email))
        return showToast("Employee already exists");

    db.employees.push({ email, role, department });
    saveToStorage();
    renderEmployeesTable();

    empEmail.value = '';
    empRole.value = 'staff';
    empDept.value = '';
    toggle('addEmployeeForm', false);
};

function renderDepartmentsTable() {
    const tbody = document.getElementById('departmentsTableBody');
    tbody.innerHTML = '';

    const departments = window.db.departments || [];
    departments.forEach((d, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.name}</td>
            <td>
                <button class="btn btn-outline-primary" onclick="showToast('Edit Department not implemented')">Edit</button>
                <button class="btn btn-outline-danger" onclick="showToast('Delete Department not implemented')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('addDepartmentBtn').classList.toggle('d-none', !currentUser || currentUser.role !== 'admin');
}

// Render user requests
function renderRequestsTable() {
    if (!currentUser) return;

    const tbody = document.getElementById('userRequestsTableBody');
    tbody.innerHTML = '';

    const requests = window.db.requests.filter(r => r.employeeEmail === currentUser.email);

    if (!requests.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No requests yet.</td></tr>`;
        return;
    }

    requests.forEach(r => {
        const itemsString = r.items ? r.items.map(item => `${item.name} (x${item.qty})`).join(", ") : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${r.type}</td>
            <td>${itemsString}</td>
            <td>${getStatusBadge(r.status)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Admin Requests for all users
function renderAdminRequests() {
    if (!currentUser || currentUser.role !== 'admin') return;

    const tbody = document.getElementById('adminRequestsTableBody');
    const requests = window.db.requests || [];

    tbody.innerHTML = '';

    if (!requests.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No requests yet.</td>
            </tr>
        `;
        return;
    }

    requests.forEach((r, i) => {
        const tr = document.createElement('tr');

        const itemsString = r.items ? r.items.map(item => `${item.name} (x${item.qty})`).join(", ") : r.description || '';

        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${r.employeeEmail}</td>
            <td>${r.type}</td>
            <td>${itemsString}</td>
            <td id="status-${i}">${getStatusBadge(r.status)}</td>
            <td></td>
        `;

        tbody.appendChild(tr);
    });
}


// Request Form
document.addEventListener('DOMContentLoaded', () => {
    const newBtn = document.getElementById('newRequestBtn');
    const form = document.getElementById('newRequestForm');
    const cancelBtn = document.getElementById('cancelRequestBtn');
    const addItemBtn = document.getElementById('addItemBtn');
    const submitBtn = document.getElementById('submitRequestBtn');

    if (newBtn) newBtn.addEventListener('click', () => form.style.display = 'block');
    if (cancelBtn) cancelBtn.addEventListener('click', () => form.style.display = 'none');

    if (addItemBtn) addItemBtn.addEventListener('click', () => {
    const container = document.getElementById('requestItemsContainer');
    const div = document.createElement('div');
    div.classList.add('requestItem', 'mb-2', 'd-flex', 'gap-2', 'align-items-center');
    div.innerHTML = `
        <input type="text" placeholder="Item Name" class="form-control itemName">
        <input type="number" placeholder="Qty" class="form-control itemQty" min="1">
        <button type="button" class="btn btn-danger removeItemBtn">×</button>
    `;
    container.appendChild(div);

    div.querySelector('.removeItemBtn').addEventListener('click', () => div.remove());
});


    if (submitBtn) submitBtn.addEventListener('click', () => {
        const type = document.getElementById('requestType').value;
        const itemsDivs = document.querySelectorAll('#requestItemsContainer .requestItem');
        const items = [];

        itemsDivs.forEach(div => {
            const name = div.querySelector('.itemName').value.trim();
            const qty = parseInt(div.querySelector('.itemQty').value);
            if (name && qty > 0) items.push({ name, qty });
        });

        if (!items.length) return showToast("Add at least one item.");

        const newRequest = {
            type,
            items,
            status: "Pending",
            date: new Date().toLocaleString(),
            employeeEmail: currentUser.email
        };

        window.db.requests.push(newRequest);
        saveToStorage();
        form.style.display = 'none';
        renderRequestsTable();
    });
});


// Log Out
function logout() {
    localStorage.removeItem('auth_token');

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';

    const adminDropdown = document.getElementById('adminDropdownContainer');
    if (adminDropdown) {
        adminDropdown.classList.add('d-none');
        adminDropdown.querySelector('.dropdown-menu')?.classList.remove('show');
    }

    const userDropdown = document.getElementById('userNavLink');
    if (userDropdown) {
        userDropdown.classList.add('d-none');
        userDropdown.querySelector('.dropdown-menu')?.classList.remove('show');
    }

    document.querySelector('.role-logged-out').classList.remove('d-none');

    currentUser = null;
    window.location.hash = '#/home';
}

document.getElementById('adminLogoutLink')?.addEventListener('click', e => {
    e.preventDefault();
    logout();
});

document.getElementById('userLogoutLink')?.addEventListener('click', e => {
    e.preventDefault();
    logout();
});

function getStatusBadge(status) {
    if (status === "Pending") return '<span style="color:orange;">Pending</span>';
    if (status === "Approved") return '<span style="color:green;">Approved</span>';
    if (status === "Rejected") return '<span style="color:red;">Rejected</span>';
    return status;
}

// Toast
function showToast(message, type = 'primary') {
    const toastEl = document.getElementById('appToast');
    const toastMsg = document.getElementById('toastMessage');

    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastMsg.textContent = message;

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}