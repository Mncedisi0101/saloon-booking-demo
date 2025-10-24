class CustomerDashboard {
    constructor() {
        this.customerId = localStorage.getItem('customerId');
        this.currentCustomer = null;
        this.currentBooking = {
            businessId: null,
            service: null,
            stylist: null,
            date: null,
            time: null
        };
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadCustomerData();
        this.setupEventListeners();
        await this.loadDashboardData();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        const userRole = localStorage.getItem('userRole');
        
        if (!session || userRole !== 'customer') {
            window.location.href = '../index.html';
            return;
        }
    }

    async loadCustomerData() {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .single();

            if (error) throw error;

            this.currentCustomer = data;
            this.customerId = data.id;
            localStorage.setItem('customerId', data.id);
            
            // Update UI
            document.getElementById('customerName').textContent = `${data.first_name} ${data.last_name}`;
            this.populateProfileForm();

        } catch (error) {
            console.error('Error loading customer data:', error);
        }
    }

    populateProfileForm() {
        if (!this.currentCustomer) return;

        document.getElementById('profileFirstName').value = this.currentCustomer.first_name;
        document.getElementById('profileLastName').value = this.currentCustomer.last_name;
        document.getElementById('profileEmail').value = this.currentCustomer.email;
        document.getElementById('profilePhone').value = this.currentCustomer.phone_number;
        document.getElementById('profileCountry').value = this.currentCustomer.country;
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            if (link.id !== 'customerLogoutBtn') {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = link.getAttribute('data-page');
                    this.showPage(page);
                });
            }
        });
         // Login form submission
        document.getElementById('customerLoginForm')?.addEventListener('submit', (e) => {
            this.handleLogin(e);
        });
        // Logout
        document.getElementById('customerLogoutBtn').addEventListener('click', () => {
            authManager.logout();
        });

        // Profile form
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            this.handleProfileUpdate(e);
        });

        // Appointment filter
        document.getElementById('appointmentFilter').addEventListener('change', () => {
            this.loadAppointments();
        });
         // Check auth state on load
        this.checkAuthState();
    }
     async checkAuthState() {
        const { data: { session } } = await supabase.auth.getSession();
        const userRole = localStorage.getItem('userRole');
        
        if (!session || userRole !== 'customer') {
            // Show login modal if not authenticated
            this.showLoginModal();
        } else {
            // User is authenticated, proceed normally
            await this.loadCustomerData();
            await this.loadDashboardData();
        }
    }

    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password'),
            userType: 'customer'
        };

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password
            });

            if (error) throw error;

            // Verify user is a customer
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', data.user.id)
                .single();

            if (customerError || !customer) {
                await supabase.auth.signOut();
                throw new Error('No customer account found with these credentials');
            }

            localStorage.setItem('userRole', 'customer');
            localStorage.setItem('customerId', customer.id);
            
            this.hideLoginModal();
            await this.loadCustomerData();
            await this.loadDashboardData();

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(error.message || 'Login failed. Please check your credentials.', 'error');
        }
    }
    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Remove active class from all sidebar links
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected page and activate sidebar link
        document.getElementById(`${pageName}-page`).classList.add('active');
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        // Load page-specific data
        switch (pageName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'book-appointment':
                this.showBookingSteps();
                break;
            case 'appointments':
                this.loadAppointments();
                break;
            case 'profile':
                // Profile form is already populated
                break;
        }
    }

    async loadDashboardData() {
        await this.loadUpcomingAppointments();
    }

    async loadUpcomingAppointments() {
        if (!this.customerId) return;

        try {
            const { data: appointments, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    businesses(business_name),
                    services(name, duration, price),
                    stylists(name)
                `)
                .eq('customer_id', this.customerId)
                .in('status', ['pending', 'confirmed'])
                .gte('appointment_date', new Date().toISOString().split('T')[0])
                .order('appointment_date')
                .order('appointment_time')
                .limit(5);

            if (error) throw error;
            this.renderUpcomingAppointments(appointments);

        } catch (error) {
            console.error('Error loading upcoming appointments:', error);
        }
    }

    renderUpcomingAppointments(appointments) {
        const container = document.getElementById('upcomingAppointmentsList');
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No upcoming appointments</p>
                    <button class="btn-primary" onclick="customerDashboard.showPage('book-appointment')">
                        Book Your First Appointment
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = appointments.map(appointment => `
            <div class="appointment-card">
                <div class="appointment-info">
                    <h4>${appointment.services.name}</h4>
                    <p>${appointment.businesses.business_name}</p>
                    <p><i class="fas fa-calendar"></i> ${new Date(appointment.appointment_date).toLocaleDateString()}</p>
                    <p><i class="fas fa-clock"></i> ${appointment.appointment_time}</p>
                </div>
                <div class="appointment-actions">
                    <span class="status-badge status-${appointment.status}">${appointment.status}</span>
                    ${appointment.status === 'pending' ? `
                        <button class="btn-sm btn-danger" onclick="customerDashboard.cancelAppointment('${appointment.id}')">
                            Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async loadAppointments() {
        if (!this.customerId) return;

        const filter = document.getElementById('appointmentFilter').value;

        try {
            let query = supabase
                .from('appointments')
                .select(`
                    *,
                    businesses(business_name, phone_number),
                    services(name, duration, price),
                    stylists(name)
                `)
                .eq('customer_id', this.customerId);

            switch (filter) {
                case 'upcoming':
                    query = query.in('status', ['pending', 'confirmed'])
                                 .gte('appointment_date', new Date().toISOString().split('T')[0]);
                    break;
                case 'past':
                    query = query.in('status', ['completed', 'cancelled', 'no_show'])
                                 .lt('appointment_date', new Date().toISOString().split('T')[0]);
                    break;
                case 'cancelled':
                    query = query.eq('status', 'cancelled');
                    break;
                // 'all' shows everything
            }

            const { data: appointments, error } = await query
                .order('appointment_date', { ascending: false })
                .order('appointment_time', { ascending: false });

            if (error) throw error;
            this.renderAppointmentsList(appointments, filter);

        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }

    renderAppointmentsList(appointments, filter) {
        const container = document.getElementById('appointmentsList');
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No ${filter} appointments found</p>
                    ${filter === 'upcoming' ? `
                        <button class="btn-primary" onclick="customerDashboard.showPage('book-appointment')">
                            Book New Appointment
                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = appointments.map(appointment => `
            <div class="appointment-card detailed">
                <div class="appointment-header">
                    <h4>${appointment.services.name}</h4>
                    <span class="status-badge status-${appointment.status}">${appointment.status}</span>
                </div>
                <div class="appointment-details">
                    <p><strong>Salon:</strong> ${appointment.businesses.business_name}</p>
                    <p><strong>Date:</strong> ${new Date(appointment.appointment_date).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                    <p><strong>Duration:</strong> ${appointment.services.duration} minutes</p>
                    <p><strong>Price:</strong> $${appointment.services.price}</p>
                    ${appointment.stylists ? `<p><strong>Stylist:</strong> ${appointment.stylists.name}</p>` : ''}
                    ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
                </div>
                <div class="appointment-actions">
                    ${appointment.status === 'pending' || appointment.status === 'confirmed' ? `
                        <button class="btn-sm btn-danger" onclick="customerDashboard.cancelAppointment('${appointment.id}')">
                            Cancel
                        </button>
                        <button class="btn-sm" onclick="customerDashboard.rescheduleAppointment('${appointment.id}')">
                            Reschedule
                        </button>
                    ` : ''}
                    ${appointment.status === 'completed' ? `
                        <button class="btn-sm btn-primary" onclick="customerDashboard.leaveFeedback('${appointment.id}')">
                            Leave Feedback
                        </button>
                    ` : ''}
                    <button class="btn-sm" onclick="customerDashboard.viewAppointmentDetails('${appointment.id}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    async cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        try {
            const { error } = await db.updateAppointment(appointmentId, { 
                status: 'cancelled' 
            });

            if (error) throw error;

            this.showNotification('Appointment cancelled successfully', 'success');
            this.loadUpcomingAppointments();
            this.loadAppointments();

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showNotification('Failed to cancel appointment', 'error');
        }
    }

    showBookingSteps() {
        const businessId = localStorage.getItem('selectedBusinessId');
        
        if (!businessId) {
            // If no business selected, show business selection
            this.showBusinessSelection();
        } else {
            // Start booking process with selected business
            this.currentBooking.businessId = businessId;
            this.showServiceSelection();
        }
    }

    showBusinessSelection() {
        const stepsContainer = document.getElementById('booking-steps');
        stepsContainer.innerHTML = `
            <div class="booking-step active">
                <h3>Select a Salon</h3>
                <p>Choose a salon to book an appointment with, or scan a QR code to quickly select a salon.</p>
                
                <div class="business-selection">
                    <div class="search-box">
                        <input type="text" id="businessSearch" placeholder="Search for salons...">
                        <i class="fas fa-search"></i>
                    </div>
                    
                    <div class="businesses-grid" id="businessesGrid">
                        <!-- Businesses will be loaded here -->
                    </div>
                    
                    <div class="qr-option">
                        <p>Or scan a salon's QR code</p>
                        <button class="btn-secondary" onclick="customerDashboard.scanQR()">
                            <i class="fas fa-qrcode"></i> Scan QR Code
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.loadBusinesses();
    }

    async loadBusinesses() {
        try {
            const { data: businesses, error } = await supabase
                .from('businesses')
                .select('id, business_name, owner_name, phone_number, email')
                .eq('is_active', true)
                .order('business_name');

            if (error) throw error;
            this.renderBusinesses(businesses);

        } catch (error) {
            console.error('Error loading businesses:', error);
        }
    }

    renderBusinesses(businesses) {
        const grid = document.getElementById('businessesGrid');
        
        if (!businesses || businesses.length === 0) {
            grid.innerHTML = '<p>No salons found</p>';
            return;
        }

        grid.innerHTML = businesses.map(business => `
            <div class="business-card" onclick="customerDashboard.selectBusiness('${business.id}')">
                <div class="business-info">
                    <h4>${business.business_name}</h4>
                    <p>Owner: ${business.owner_name}</p>
                    <p><i class="fas fa-phone"></i> ${business.phone_number}</p>
                </div>
                <div class="business-actions">
                    <button class="btn-primary">Select</button>
                </div>
            </div>
        `).join('');
    }

    selectBusiness(businessId) {
        localStorage.setItem('selectedBusinessId', businessId);
        this.currentBooking.businessId = businessId;
        this.showServiceSelection();
    }

    async showServiceSelection() {
        if (!this.currentBooking.businessId) return;

        try {
            const { data: services, error } = await db.getServices(this.currentBooking.businessId);

            if (error) throw error;

            const stepsContainer = document.getElementById('booking-steps');
            stepsContainer.innerHTML = `
                <div class="booking-step active">
                    <h3>Select Service</h3>
                    <p>Choose the service you'd like to book</p>
                    
                    <div class="services-grid">
                        ${services.map(service => `
                            <div class="service-card ${this.currentBooking.service?.id === service.id ? 'selected' : ''}" 
                                 onclick="customerDashboard.selectService(${JSON.stringify(service).replace(/"/g, '&quot;')})">
                                <h4>${service.name}</h4>
                                <p class="service-category">${service.category}</p>
                                <p class="service-description">${service.description || 'No description available'}</p>
                                <div class="service-details">
                                    <span class="duration">${service.duration} min</span>
                                    <span class="price">$${service.price}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="booking-navigation">
                        <button class="btn-secondary" onclick="customerDashboard.showBusinessSelection()">
                            Back
                        </button>
                        ${this.currentBooking.service ? `
                            <button class="btn-primary" onclick="customerDashboard.showStylistSelection()">
                                Next: Select Stylist
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    selectService(service) {
        this.currentBooking.service = service;
        this.showServiceSelection(); // Re-render to show selection
    }

    async showStylistSelection() {
        if (!this.currentBooking.businessId || !this.currentBooking.service) return;

        try {
            const { data: stylists, error } = await supabase
                .from('stylists')
                .select('*')
                .eq('business_id', this.currentBooking.businessId)
                .eq('is_available', true);

            if (error) throw error;

            const stepsContainer = document.getElementById('booking-steps');
            stepsContainer.innerHTML = `
                <div class="booking-step active">
                    <h3>Select Stylist</h3>
                    <p>Choose your preferred stylist or select "No Preference"</p>
                    
                    <div class="stylists-selection">
                        <div class="stylist-option ${!this.currentBooking.stylist ? 'selected' : ''}" 
                             onclick="customerDashboard.selectStylist(null)">
                            <div class="stylist-info">
                                <h4>No Preference</h4>
                                <p>We'll assign the best available stylist for you</p>
                            </div>
                        </div>
                        
                        ${stylists.map(stylist => `
                            <div class="stylist-option ${this.currentBooking.stylist?.id === stylist.id ? 'selected' : ''}" 
                                 onclick="customerDashboard.selectStylist(${JSON.stringify(stylist).replace(/"/g, '&quot;')})">
                                <div class="stylist-photo">
                                    ${stylist.profile_picture_url ? 
                                        `<img src="${stylist.profile_picture_url}" alt="${stylist.name}">` :
                                        `<div class="stylist-initials">${stylist.name.split(' ').map(n => n[0]).join('')}</div>`
                                    }
                                </div>
                                <div class="stylist-info">
                                    <h4>${stylist.name}</h4>
                                    <p class="specialization">${stylist.specialization || 'General Stylist'}</p>
                                    <p class="availability">Available</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="booking-navigation">
                        <button class="btn-secondary" onclick="customerDashboard.showServiceSelection()">
                            Back
                        </button>
                        ${this.currentBooking.stylist !== undefined ? `
                            <button class="btn-primary" onclick="customerDashboard.showDateTimeSelection()">
                                Next: Select Date & Time
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading stylists:', error);
        }
    }

    selectStylist(stylist) {
        this.currentBooking.stylist = stylist;
        this.showStylistSelection(); // Re-render to show selection
    }

    showDateTimeSelection() {
        // This would show a calendar and time slot selection
        // For now, we'll show a simplified version
        const stepsContainer = document.getElementById('booking-steps');
        stepsContainer.innerHTML = `
            <div class="booking-step active">
                <h3>Select Date & Time</h3>
                <p>Choose when you'd like to visit the salon</p>
                
                <div class="datetime-selection">
                    <div class="form-group">
                        <label for="appointmentDate">Date</label>
                        <input type="date" id="appointmentDate" min="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label for="appointmentTime">Time</label>
                        <select id="appointmentTime">
                            <option value="">Select Time</option>
                            <option value="09:00">09:00 AM</option>
                            <option value="09:30">09:30 AM</option>
                            <option value="10:00">10:00 AM</option>
                            <option value="10:30">10:30 AM</option>
                            <option value="11:00">11:00 AM</option>
                            <option value="11:30">11:30 AM</option>
                            <option value="12:00">12:00 PM</option>
                            <option value="12:30">12:30 PM</option>
                            <option value="13:00">01:00 PM</option>
                            <option value="13:30">01:30 PM</option>
                            <option value="14:00">02:00 PM</option>
                            <option value="14:30">02:30 PM</option>
                            <option value="15:00">03:00 PM</option>
                            <option value="15:30">03:30 PM</option>
                            <option value="16:00">04:00 PM</option>
                            <option value="16:30">04:30 PM</option>
                            <option value="17:00">05:00 PM</option>
                        </select>
                    </div>
                </div>
                
                <div class="booking-navigation">
                    <button class="btn-secondary" onclick="customerDashboard.showStylistSelection()">
                        Back
                    </button>
                    <button class="btn-primary" onclick="customerDashboard.showConfirmation()">
                        Next: Confirm Booking
                    </button>
                </div>
            </div>
        `;
    }

    showConfirmation() {
        const date = document.getElementById('appointmentDate').value;
        const time = document.getElementById('appointmentTime').value;

        if (!date || !time) {
            this.showNotification('Please select both date and time', 'error');
            return;
        }

        this.currentBooking.date = date;
        this.currentBooking.time = time;

        const stepsContainer = document.getElementById('booking-steps');
        stepsContainer.innerHTML = `
            <div class="booking-step active">
                <h3>Confirm Booking</h3>
                <p>Please review your appointment details</p>
                
                <div class="booking-summary">
                    <div class="summary-item">
                        <strong>Service:</strong> ${this.currentBooking.service.name}
                    </div>
                    <div class="summary-item">
                        <strong>Stylist:</strong> ${this.currentBooking.stylist ? this.currentBooking.stylist.name : 'No Preference'}
                    </div>
                    <div class="summary-item">
                        <strong>Date:</strong> ${new Date(date).toLocaleDateString()}
                    </div>
                    <div class="summary-item">
                        <strong>Time:</strong> ${time}
                    </div>
                    <div class="summary-item">
                        <strong>Duration:</strong> ${this.currentBooking.service.duration} minutes
                    </div>
                    <div class="summary-item total">
                        <strong>Total:</strong> $${this.currentBooking.service.price}
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="bookingNotes">Additional Notes (Optional)</label>
                    <textarea id="bookingNotes" rows="3" placeholder="Any special requests or notes..."></textarea>
                </div>
                
                <div class="booking-navigation">
                    <button class="btn-secondary" onclick="customerDashboard.showDateTimeSelection()">
                        Back
                    </button>
                    <button class="btn-primary" onclick="customerDashboard.confirmBooking()">
                        Confirm Booking
                    </button>
                </div>
            </div>
        `;
    }

    async confirmBooking() {
        if (!this.currentBooking.service || !this.currentBooking.date || !this.currentBooking.time) {
            this.showNotification('Please complete all booking steps', 'error');
            return;
        }

        try {
            const notes = document.getElementById('bookingNotes').value;

            const appointmentData = {
                business_id: this.currentBooking.businessId,
                customer_id: this.customerId,
                service_id: this.currentBooking.service.id,
                stylist_id: this.currentBooking.stylist?.id || null,
                appointment_date: this.currentBooking.date,
                appointment_time: this.currentBooking.time,
                status: 'pending',
                notes: notes,
                total_amount: this.currentBooking.service.price
            };

            const { data: appointment, error } = await db.createAppointment(appointmentData);

            if (error) throw error;

            this.showNotification('Appointment booked successfully!', 'success');
            
            // Reset booking
            this.currentBooking = {
                businessId: this.currentBooking.businessId, // Keep business selected
                service: null,
                stylist: null,
                date: null,
                time: null
            };

            // Redirect to appointments page
            this.showPage('appointments');

        } catch (error) {
            console.error('Error creating appointment:', error);
            this.showNotification('Failed to book appointment', 'error');
        }
    }

    scanQR() {
        window.location.href = 'qr-scanner.html';
    }

    async handleProfileUpdate(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const updates = {
            first_name: formData.get('firstName'),
            last_name: formData.get('lastName'),
            phone_number: formData.get('phoneNumber'),
            country: formData.get('country')
        };

        try {
            const { error } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', this.customerId);

            if (error) throw error;

            this.showNotification('Profile updated successfully', 'success');
            await this.loadCustomerData(); // Reload customer data

        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Failed to update profile', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Similar to business dashboard notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 1rem;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize customer dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.customerDashboard = new CustomerDashboard();
});