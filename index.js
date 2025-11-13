// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAGmFXURLC0zf8epsQXPuidKzQMy4GCQeM",
    authDomain: "consultoriodramonelli.firebaseapp.com",
    projectId: "consultoriodramonelli",
    storageBucket: "consultoriodramonelli.firebasestorage.app",
    messagingSenderId: "891940025413",
    appId: "1:891940025413:web:572cdade02af2f31475f2c",
    measurementId: "G-42N61LN5D3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Modal functionality
const whatsappModal = document.getElementById('whatsapp-modal');
const whatsappBtn = document.getElementById('whatsapp-btn');
const modalTurnoInfo = document.getElementById('modal-turno-info');

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target === whatsappModal) {
        whatsappModal.style.display = 'none';
    }
});

// Chatbot functionality
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    
    let currentStep = 0;
    let appointmentData = {
        pacienteNombre: '',
        pacienteApellido: '',
        pacienteDNI: '',
        servicio: '',
        fecha: '',
        hora: '',
        estado: 'confirmado'
    };

    const steps = [
        {
            question: "¡Hola! Soy tu asistente virtual para agendar turnos. ¿Cuál es tu nombre?",
            field: "pacienteNombre"
        },
        {
            question: "Gracias {pacienteNombre}. ¿Cuál es tu apellido?",
            field: "pacienteApellido"
        },
        {
            question: "Perfecto. Ahora necesito tu número de DNI.",
            field: "pacienteDNI"
        },
        {
            question: "¿Qué servicio necesitas?",
            field: "servicio",
            options: [
                "Consulta General",
                "Certificado Médico/Escolar",
                "Toma de Tensión/Glucemia",
                "Electrocardiograma",
                "Curación",
                "Fichas Médicas",
                "Fichas Escolares (CUS)",
                "Aptos Médicos",
                "Colocación de Inyectables",
                "Psiquiatría",
                "Homeopatía"
            ]
        },
        {
            question: "Selecciona una fecha para tu turno:",
            field: "fecha",
            type: "calendar"
        },
        {
            question: "Selecciona un horario disponible:",
            field: "hora",
            type: "time"
        }
    ];

    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter key
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        addUserMessage(message);
        userInput.value = '';

        // Process user input based on current step
        setTimeout(() => {
            processUserInput(message);
        }, 500);
    }

    function processUserInput(input) {
        const currentStepData = steps[currentStep];
        
        // Si estamos en un paso de calendario o tiempo, no procesar input de texto
        if (currentStepData.type === 'calendar' || currentStepData.type === 'time') {
            return;
        }

        if (currentStepData.field === 'pacienteDNI') {
            const dniRegex = /^\d{7,8}$/;
            if (dniRegex.test(input)) {
                appointmentData[currentStepData.field] = input;
                nextStep();
            } else {
                addBotMessage("Por favor, ingresa un DNI válido (solo números, 7 u 8 dígitos).");
            }
        } else if (currentStepData.options) {
            const selectedOption = currentStepData.options.find(opt => 
                opt.toLowerCase().includes(input.toLowerCase()) || 
                input.toLowerCase().includes(opt.toLowerCase())
            );
            
            if (selectedOption) {
                appointmentData[currentStepData.field] = selectedOption;
                nextStep();
            } else {
                addBotMessage("Por favor, selecciona una de las opciones disponibles:");
                showOptions(currentStepData.options);
            }
        } else {
            // Para nombre y apellido, aceptar cualquier texto
            if (input.length < 2) {
                addBotMessage("Por favor, ingresa un nombre válido (mínimo 2 caracteres).");
                return;
            }
            
            appointmentData[currentStepData.field] = input;
            nextStep();
        }
    }

    function nextStep() {
        currentStep++;
        
        if (currentStep < steps.length) {
            let question = steps[currentStep].question;
            
            // Reemplazar variables en el mensaje
            question = question.replace(/{pacienteNombre}/g, appointmentData.pacienteNombre);
            question = question.replace(/{pacienteApellido}/g, appointmentData.pacienteApellido);
            question = question.replace(/{servicio}/g, appointmentData.servicio);
            question = question.replace(/{fecha}/g, appointmentData.fecha);
            question = question.replace(/{hora}/g, appointmentData.hora);
            
            addBotMessage(question);
            
            if (steps[currentStep].type === 'calendar') {
                showCalendar();
            } else if (steps[currentStep].type === 'time') {
                showTimeSlots();
            } else if (steps[currentStep].options) {
                showOptions(steps[currentStep].options);
            }
        } else {
            saveAppointment();
        }
    }

    function showOptions(options) {
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options-container';
    
    // Agregar información sobre servicios especiales
    const infoDiv = document.createElement('div');
    infoDiv.className = 'service-info';
    infoDiv.style.cssText = `
        background: #e3f2fd;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 15px;
        border-left: 4px solid #2196f3;
        font-size: 0.9em;
    `;
    
    infoDiv.innerHTML = `
        <strong>📅 Horarios Especiales:</strong><br>
        • <strong>Psiquiatría:</strong> Solo MARTES 16:00-20:00<br>
        • <strong>Homeopatía:</strong> Solo MIÉRCOLES 16:00-20:00<br>
        • <strong>Electrocardiograma:</strong> Solo TARDES 16:00-20:00
    `;
    
    optionsContainer.appendChild(infoDiv);
    
    options.forEach(option => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'option-btn';
        optionBtn.textContent = option;
        optionBtn.addEventListener('click', () => {
            addUserMessage(option);
            appointmentData[steps[currentStep].field] = option;
            
            // Mostrar información específica del servicio seleccionado
            if (option === "Psiquiatría") {
                addBotMessage("💡 <strong>Psiquiatría:</strong> Recuerda que este servicio atiende solo los MARTES de 16:00 a 20:00 hs.");
            } else if (option === "Homeopatía") {
                addBotMessage("💡 <strong>Homeopatía:</strong> Recuerda que este servicio atiende solo los MIÉRCOLES de 16:00 a 20:00 hs.");
            }
            
            nextStep();
        });
        optionsContainer.appendChild(optionBtn);
    });
    
    chatMessages.appendChild(optionsContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showCalendar() {
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-container';
    
    // Crear calendario inteligente CON EL SERVICIO
    const calendar = new Calendar(appointmentData.servicio);
    const calendarElement = calendar.render();
    calendarContainer.appendChild(calendarElement);
    
    chatMessages.appendChild(calendarContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

    // Clase Calendar para manejar el calendario inteligente
    class Calendar {
        constructor(servicio) {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.servicio = servicio; // Guardar el servicio seleccionado
    }

        render() {
            const container = document.createElement('div');
            container.className = 'calendar-wrapper';
            
            // Header del calendario con navegación
            const header = this.createHeader();
            container.appendChild(header);
            
            // Días de la semana
            const weekdays = this.createWeekdays();
            container.appendChild(weekdays);
            
            // Días del mes
            const daysGrid = this.createDaysGrid();
            container.appendChild(daysGrid);
            
            // Leyenda e información
            const info = this.createInfo();
            container.appendChild(info);
            
            return container;
        }

        createHeader() {
            const header = document.createElement('div');
            header.className = 'calendar-header';
            
            const monthYear = document.createElement('div');
            monthYear.className = 'calendar-month';
            monthYear.textContent = this.getMonthYearString();
            monthYear.id = 'current-month-year';
            
            const nav = document.createElement('div');
            nav.className = 'calendar-nav';
            
            const prevBtn = document.createElement('button');
            prevBtn.className = 'calendar-nav-btn';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.onclick = () => this.previousMonth();
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'calendar-nav-btn';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.onclick = () => this.nextMonth();
            
            nav.appendChild(prevBtn);
            nav.appendChild(nextBtn);
            header.appendChild(monthYear);
            header.appendChild(nav);
            
            return header;
        }

        createWeekdays() {
            const weekdaysContainer = document.createElement('div');
            weekdaysContainer.className = 'calendar-weekdays';
            
            const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            weekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-weekday';
                dayElement.textContent = day;
                weekdaysContainer.appendChild(dayElement);
            });
            
            return weekdaysContainer;
        }

        createDaysGrid() {
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        grid.id = 'calendar-grid';
        
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const today = new Date();
        
        // Días vacíos al inicio
        const startDay = firstDay.getDay();
        for (let i = 0; i < startDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            grid.appendChild(emptyDay);
        }
        
        // Días del mes
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            // Verificar si es hoy
            if (this.isToday(date)) {
                dayElement.classList.add('today');
            }
            
            // VERIFICAR DISPONIBILIDAD SEGÚN SERVICIO
            const isAvailable = this.isDateAvailableForService(date);
            
            if (!isAvailable || this.isPastDate(date)) {
                dayElement.classList.add('disabled');
                if (!isAvailable) {
                    dayElement.title = this.getUnavailableReason(date);
                }
            } else {
                dayElement.addEventListener('click', () => {
                    this.selectDate(date, dayElement);
                });
            }
            
            grid.appendChild(dayElement);
        }
        
        return grid;
        }
        
        // NUEVA FUNCIÓN: Verificar disponibilidad según servicio
        isDateAvailableForService(date) {
            const dayOfWeek = date.getDay(); // 0=domingo, 1=lunes, 2=martes, etc.
            
            // ELIMINAR SÁBADOS (día 6) - CONSULTORIO CERRADO
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingos y Sábados
                return false;
            }
            
            // PSIQUIATRÍA - Solo martes (día 2)
            if (this.servicio === "Psiquiatría") {
                return dayOfWeek === 2; // Solo martes
            }
            
            // HOMEOPATÍA - Solo miércoles (día 3)
            if (this.servicio === "Homeopatía") {
                return dayOfWeek === 3; // Solo miércoles
            }
            
            // SERVICIOS NORMALES - Lunes a Viernes (días 1-5)
            return dayOfWeek >= 1 && dayOfWeek <= 5; // Lunes a Viernes
        }

        // NUEVA FUNCIÓN: Mensaje de no disponibilidad
        // NUEVA FUNCIÓN: Mensaje de no disponibilidad
        getUnavailableReason(date) {
            const dayOfWeek = date.getDay();
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            // RAZONES GENERALES (consultorio cerrado)
            if (dayOfWeek === 0) {
                return "❌ Consultorio cerrado los DOMINGOS";
            }
            
            if (dayOfWeek === 6) {
                return "❌ Consultorio cerrado los SÁBADOS";
            }
            
            // RAZONES ESPECÍFICAS POR SERVICIO
            if (this.servicio === "Psiquiatría" && dayOfWeek !== 2) {
                return `❌ Psiquiatría solo atiende los MARTES (Hoy es ${dayNames[dayOfWeek]})`;
            }
            
            if (this.servicio === "Homeopatía" && dayOfWeek !== 3) {
                return `❌ Homeopatía solo atiende los MIÉRCOLES (Hoy es ${dayNames[dayOfWeek]})`;
            }
            
            return "Fecha no disponible";
        }

        createInfo() {
    const infoContainer = document.createElement('div');
    infoContainer.className = 'calendar-info-container';
    
    const legends = document.createElement('div');
    legends.className = 'calendar-legends';
    
    const todayLegend = document.createElement('div');
    todayLegend.className = 'legend-item';
    todayLegend.innerHTML = `
        <div class="legend-color legend-today"></div>
        <span>Hoy</span>
    `;
    
    const selectedLegend = document.createElement('div');
    selectedLegend.className = 'legend-item';
    selectedLegend.innerHTML = `
        <div class="legend-color legend-selected"></div>
        <span>Seleccionado</span>
    `;
    
    const disabledLegend = document.createElement('div');
    disabledLegend.className = 'legend-item';
    disabledLegend.innerHTML = `
        <div class="legend-color legend-disabled"></div>
        <span>No disponible</span>
    `;
    
    legends.appendChild(todayLegend);
    legends.appendChild(selectedLegend);
    legends.appendChild(disabledLegend);
    
    // INFORMACIÓN ESPECÍFICA DEL SERVICIO Y HORARIOS
    const serviceInfo = document.createElement('div');
    serviceInfo.className = 'calendar-service-info';
    serviceInfo.style.cssText = `
        background: #e8f5e8;
        border-radius: 8px;
        padding: 12px;
        margin-top: 15px;
        border-left: 4px solid #4caf50;
        font-size: 0.9em;
        line-height: 1.5;
    `;
    
    let serviceMessage = "";
    if (this.servicio === "Psiquiatría") {
        serviceMessage = "📅 <strong>Psiquiatría:</strong> Solo MARTES 16:00-20:00<br>";
    } else if (this.servicio === "Homeopatía") {
        serviceMessage = "📅 <strong>Homeopatía:</strong> Solo MIÉRCOLES 16:00-20:00<br>";
    } else if (this.servicio === "Electrocardiograma") {
        serviceMessage = "📅 <strong>Electrocardiograma:</strong> Solo TARDES 16:00-20:00<br>";
    } else {
        serviceMessage = "📅 <strong>Servicios generales:</strong> Lunes a Viernes<br>";
    }
    
    serviceMessage += "🏥 <strong>Horario consultorio:</strong> Lunes a Viernes 8:00-20:00<br>";
    serviceMessage += "❌ <strong>Cerrado:</strong> Sábados y Domingos";
    
    serviceInfo.innerHTML = serviceMessage;
    
    const instructions = document.createElement('div');
    instructions.className = 'calendar-instructions';
    instructions.textContent = 'Selecciona una fecha disponible (Lunes a Viernes)';
    
    infoContainer.appendChild(legends);
    infoContainer.appendChild(serviceInfo);
    infoContainer.appendChild(instructions);
    
    return infoContainer;
}

        getMonthYearString() {
            const months = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }

        previousMonth() {
            this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
            this.updateCalendar();
        }

        nextMonth() {
            this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
            this.updateCalendar();
        }

        updateCalendar() {
            // Actualizar el texto del mes y año
            const monthYearElement = document.getElementById('current-month-year');
            if (monthYearElement) {
                monthYearElement.textContent = this.getMonthYearString();
            }
            
            // Actualizar la grilla de días
            const gridElement = document.getElementById('calendar-grid');
            if (gridElement) {
                const newGrid = this.createDaysGrid();
                gridElement.parentNode.replaceChild(newGrid, gridElement);
            }
        }

        isToday(date) {
            const today = new Date();
            return date.toDateString() === today.toDateString();
        }

        isPastDate(date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date < today;
        }

        selectDate(date, element) {
            // Remover selección anterior
            document.querySelectorAll('.calendar-day.selected').forEach(day => {
                day.classList.remove('selected');
            });
            
            // Agregar selección actual
            element.classList.add('selected');
            this.selectedDate = date;
            
            // Guardar la fecha seleccionada
            const selectedDate = this.formatDate(date);
            appointmentData.fecha = selectedDate;
            
            // Mostrar confirmación
            setTimeout(() => {
                addUserMessage(this.formatDisplayDate(selectedDate));
                nextStep();
            }, 500);
        }

        formatDate(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        formatDisplayDate(dateString) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', options);
        }
    }

    async function showTimeSlots() {
    addBotMessage("Buscando horarios disponibles...");
    
    try {
        const bookedSlots = await getBookedTimeSlots(appointmentData.fecha);
        
        const timeSlotsContainer = document.createElement('div');
        timeSlotsContainer.className = 'time-slots';
        
        const selectedDate = new Date(appointmentData.fecha + 'T00:00:00');
        const dayOfWeek = selectedDate.getDay();
        const isToday = isTodayDate(selectedDate);
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // DEFINIR HORARIOS SEGÚN SERVICIO
        let availableTimeSlots = [];
        const servicio = appointmentData.servicio;
        
        // PSIQUIATRÍA - Solo martes 16:00-20:00
        if (servicio === "Psiquiatría") {
            availableTimeSlots = generateTimeSlots(16, 20, 20);
        }
        // HOMEOPATÍA - Solo miércoles 16:00-20:00
        else if (servicio === "Homeopatía") {
            availableTimeSlots = generateTimeSlots(16, 20, 20);
        }
        // ELECTROCARDIOGRAMA - Solo por la tarde
        else if (servicio === "Electrocardiograma") {
            availableTimeSlots = generateTimeSlots(16, 20, 20);
        }
        // SERVICIOS NORMALES - LUNES A VIERNES
        else if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Solo Lunes a Viernes
            // Horario de mañana
            availableTimeSlots = availableTimeSlots.concat(generateTimeSlots(8, 12, 20));
            // Horario de tarde
            availableTimeSlots = availableTimeSlots.concat(generateTimeSlots(16, 20, 20));
        }
        // SÁBADOS Y DOMINGOS - NO HAY HORARIOS
        else {
            availableTimeSlots = [];
        }
        
        let availableSlots = 0;
        
        availableTimeSlots.forEach(time => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = time;
            timeSlot.setAttribute('data-time', time);
            
            // Verificar si el horario está ocupado
            const isBooked = bookedSlots.includes(time);
            
            // Verificar si es un horario pasado (solo para hoy)
            let isPastTime = false;
            if (isToday) {
                const slotHour = parseInt(time.split(':')[0]);
                const slotMinute = parseInt(time.split(':')[1]);
                if (slotHour < currentHour || (slotHour === currentHour && slotMinute < currentMinute)) {
                    isPastTime = true;
                }
            }
            
            if (isBooked || isPastTime) {
                timeSlot.classList.add('ocupado');
                if (isPastTime) {
                    timeSlot.title = 'Horario ya pasó';
                } else {
                    timeSlot.title = 'Horario no disponible';
                }
            } else {
                availableSlots++;
                timeSlot.addEventListener('click', () => {
                    document.querySelectorAll('.time-slot').forEach(slot => {
                        slot.classList.remove('selected');
                    });
                    timeSlot.classList.add('selected');
                    
                    appointmentData.hora = time;
                    
                    // VALIDAR SERVICIO ESPECIAL
                    const validacion = validarDisponibilidadServicio(servicio, appointmentData.fecha, time);
                    if (!validacion.valido) {
                        addBotMessage(validacion.mensaje);
                        return;
                    }
                    
                    addUserMessage(time);
                    nextStep();
                });
            }
            
            timeSlotsContainer.appendChild(timeSlot);
        });
        
        // CORRECCIÓN: Solo eliminar el último mensaje si existe y es el de "Buscando horarios..."
        const lastMessage = chatMessages.lastChild;
        if (lastMessage && lastMessage.textContent.includes("Buscando horarios disponibles")) {
            chatMessages.removeChild(lastMessage);
        }
        
        if (availableSlots === 0) {
            let message = "Lo siento, no hay horarios disponibles para esta fecha.";
            
            // Mensajes específicos por servicio y día
            if (servicio === "Psiquiatría") {
                message = "❌ No hay horarios disponibles para Psiquiatría. Recuerda que atiende solo los MARTES de 16:00 a 20:00.";
            } else if (servicio === "Homeopatía") {
                message = "❌ No hay horarios disponibles para Homeopatía. Recuerda que atiende solo los MIÉRCOLES de 16:00 a 20:00.";
            } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                message = "❌ El consultorio está cerrado los SÁBADOS y DOMINGOS. Por favor, selecciona un día de Lunes a Viernes.";
            } else if (servicio === "Electrocardiograma") {
                message += " Recuerda que los electrocardiogramas solo se realizan por la tarde (16:00 - 20:00).";
            }
            
            addBotMessage(message);
            // CORRECCIÓN: No retroceder el paso, permitir seleccionar otra fecha
            showCalendar();
        } else {
            let message = "Estos son los horarios disponibles para el " + formatDisplayDate(appointmentData.fecha) + ":";
            
            // Información específica por servicio
            if (servicio === "Psiquiatría") {
                message = "✅ Horarios disponibles para PSIQUIATRÍA (Solo martes 16:00-20:00):";
            } else if (servicio === "Homeopatía") {
                message = "✅ Horarios disponibles para HOMEOPATÍA (Solo miércoles 16:00-20:00):";
            } else if (servicio === "Electrocardiograma") {
                message += " (Electrocardiogramas solo por la tarde)";
            }
            
            addBotMessage(message);
            chatMessages.appendChild(timeSlotsContainer);
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading time slots:', error);
        
        // CORRECCIÓN: Manejar mejor el error sin romper el flujo
        const lastMessage = chatMessages.lastChild;
        if (lastMessage && lastMessage.textContent.includes("Buscando horarios disponibles")) {
            chatMessages.removeChild(lastMessage);
        }
        
        addBotMessage("❌ Hubo un error al cargar los horarios. Por favor, selecciona otra fecha.");
        showCalendar(); // Volver al calendario en lugar de romper el flujo
    }
}

    // Función para generar slots de tiempo
    function generateTimeSlots(startHour, endHour, intervalMinutes) {
        const slots = [];
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += intervalMinutes) {
                const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                slots.push(time);
            }
        }
        return slots;
    }
    function validarDisponibilidadServicio(servicio, fecha, hora) {
        try {
            const fechaObj = new Date(fecha + 'T00:00:00');
            const diaSemana = fechaObj.getDay(); // 0=domingo, 1=lunes, 2=martes, etc.
            const horaNum = parseInt(hora.split(':')[0]);
            
            // PSIQUIATRÍA - Solo martes de 16:00 a 20:00
            if (servicio === "Psiquiatría") {
                if (diaSemana !== 2) { // 2 = martes
                    return { 
                        valido: false, 
                        mensaje: "❌ La Psiquiatría solo atiende los MARTES. Por favor, selecciona un martes." 
                    };
                }
                if (horaNum < 16 || horaNum >= 20) {
                    return { 
                        valido: false, 
                        mensaje: "❌ Psiquiatría: Horario de atención 16:00 a 20:00 hs" 
                    };
                }
            }
            
            // HOMEOPATÍA - Solo miércoles de 16:00 a 20:00  
            if (servicio === "Homeopatía") {
                if (diaSemana !== 3) { // 3 = miércoles
                    return { 
                        valido: false, 
                        mensaje: "❌ La Homeopatía solo atiende los MIÉRCOLES. Por favor, selecciona un miércoles." 
                    };
                }
                if (horaNum < 16 || horaNum >= 20) {
                    return { 
                        valido: false, 
                        mensaje: "❌ Homeopatía: Horario de atención 16:00 a 20:00 hs" 
                    };
                }
            }
            
            // ELECTROCARDIOGRAMA - Solo por la tarde
            if (servicio === "Electrocardiograma") {
                if (horaNum < 16 || horaNum >= 20) {
                    return { 
                        valido: false, 
                        mensaje: "❌ Electrocardiograma: Solo se realizan por la tarde (16:00 a 20:00 hs)" 
                    };
                }
            }
            
            return { valido: true };
        } catch (error) {
            console.error('Error en validarDisponibilidadServicio:', error);
            return { valido: true }; // En caso de error, permitir continuar
        }
    }
    // Función auxiliar para verificar si una fecha es hoy
function isTodayDate(date) {
    try {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    } catch (error) {
        console.error('Error en isTodayDate:', error);
        return false;
    }
}

    async function getBookedTimeSlots(date) {
    try {
        // Validar que la fecha sea válida
        if (!date || isNaN(new Date(date + 'T00:00:00').getTime())) {
            console.error('Fecha inválida en getBookedTimeSlots:', date);
            return [];
        }
        
        const snapshot = await db.collection('turnos')
            .where('fecha', '==', date)
            .where('estado', 'in', ['confirmado', 'completado'])
            .get();
        
        const bookedSlots = [];
        snapshot.forEach(doc => {
            const turno = doc.data();
            // Solo agregar si tiene hora válida
            if (turno.hora && turno.hora.trim() !== '') {
                bookedSlots.push(turno.hora);
            }
        });
        
        return bookedSlots;
    } catch (error) {
        console.error('Error getting booked slots:', error);
        return [];
    }
}
    async function saveAppointment() {
        try {
            appointmentData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            const docRef = await db.collection('turnos').add(appointmentData);
            
            addBotMessage("¡Perfecto! Tu turno ha sido agendado exitosamente.");
            
            showWhatsAppModal(appointmentData);
            
            setTimeout(() => {
                currentStep = 0;
                appointmentData = {
                    pacienteNombre: '',
                    pacienteApellido: '',
                    pacienteDNI: '',
                    servicio: '',
                    fecha: '',
                    hora: '',
                    estado: 'confirmado'
                };
                addBotMessage("¿Necesitas agendar otro turno?");
                addBotMessage(steps[0].question);
            }, 8000);
            
        } catch (error) {
            console.error('Error saving appointment:', error);
            addBotMessage(`<div class="alert alert-error">
                Hubo un error al guardar tu turno. Por favor, intenta nuevamente o contacta al consultorio por teléfono.
            </div>`);
        }
    }

    function showWhatsAppModal(appointmentData) {
        modalTurnoInfo.innerHTML = `
            📅 Fecha: ${formatDisplayDate(appointmentData.fecha)}<br>
            ⏰ Hora: ${appointmentData.hora}<br>
            🏥 Servicio: ${appointmentData.servicio}<br>
            👤 Paciente: ${appointmentData.pacienteNombre} ${appointmentData.pacienteApellido}<br>
            🆔 DNI: ${appointmentData.pacienteDNI}
        `;
        
        const whatsappLink = createWhatsAppLink(appointmentData);
        whatsappBtn.href = whatsappLink;
        
        whatsappModal.style.display = 'flex';
    }

    function createWhatsAppLink(appointmentData) {
        const phoneNumber = "5493516171004";
        const message = createWhatsAppMessageText(appointmentData);
        const encodedMessage = encodeURIComponent(message);
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            return `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`;
        } else {
            return `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
        }
    }

    function createWhatsAppMessageText(appointmentData) {
        return `✅ Turno Confirmado - Centro Médico Dra. Monelli

📅 Fecha: ${formatDisplayDate(appointmentData.fecha)}
⏰ Hora: ${appointmentData.hora}
🏥 Servicio: ${appointmentData.servicio}
👤 Paciente: ${appointmentData.pacienteNombre} ${appointmentData.pacienteApellido}
🆔 DNI: ${appointmentData.pacienteDNI}

Ubicación: Av. Siempre Viva 123, Córdoba
Teléfono: +54 351 617-1004

Por favor llegue 10 minutos antes de su turno.`;
    }

    function formatDisplayDate(dateString) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', options);
    }

    function addBotMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bot-message';
        messageElement.innerHTML = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addUserMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});