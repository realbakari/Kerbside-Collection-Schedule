// Configuration
const CONFIG = {
    PAGINATION: {
        ITEMS_PER_PAGE: 16,
        UPDATE_INTERVAL: 60000 // 1 minute
    },
    EXPORT: {
        CSV_FILENAME: 'kerbside_collection_schedule.csv',
        PDF_FILENAME: 'kerbside_collection_schedule.pdf'
    },
    DEBOUNCE_DELAY: 300,
    DEBUG: false
};

// Debug logging utility
const log = (...args) => CONFIG.DEBUG && console.log(...args);

// State
let allData = [];
let currentPage = 1;
let activeStatFilter = null; // Track which stat card filter is active
let trackedSuburbs = []; // Array of tracked suburbs
let activeTrackedSuburb = null; // Currently selected tracked suburb
let deferredPrompt = null; // PWA install prompt

const brisbaneCitySuburbs = [
    "Acacia Ridge", "Albion", "Alderley", "Algester", "Annerley", "Anstead", "Archerfield", "Ascot", "Ashgrove", "Aspley",
    "Auchenflower", "Bald Hills", "Balmoral", "Banyo", "Bardon", "Bellbowrie", "Belmont", "Boondall", "Bowen Hills", "Bracken Ridge",
    "Brighton", "Brookfield", "Bulimba", "Burbank", "Calamvale", "Camp Hill", "Cannon Hill", "Capalaba", "Carina", "Carina Heights",
    "Carindale", "Carseldine", "Chandler", "Chapel Hill", "Chermside", "Chermside West", "Chuwar", "Clayfield", "Coopers Plains", "Coorparoo",
    "Corinda", "Darra", "Deagon", "Doolandella", "Drewvale", "Durack", "Dutton Park", "East Brisbane", "Eight Mile Plains", "Ellen Grove",
    "Enoggera", "Everton Park", "Fairfield", "Ferny Grove", "Fig Tree Pocket", "Fitzgibbon", "Forest Lake", "Fortitude Valley", "Gaythorne", "Geebung",
    "Graceville", "Grange", "Greenslopes", "Gumdale", "Hamilton", "Hawthorne", "Heathwood", "Hemmant", "Hendra", "Herston",
    "Highgate Hill", "Holland Park", "Holland Park West", "Inala", "Indooroopilly", "Jamboree Heights", "Jindalee", "Kangaroo Point", "Karana Downs", "Kedron",
    "Kelvin Grove", "Kenmore", "Kenmore Hills", "Keperra", "Kholo", "Kuraby", "Lota", "Lutwyche", "Macgregor", "Mackenzie",
    "Manly", "Manly West", "Mansfield", "McDowall", "Middle Park", "Milton", "Mitchelton", "Moggill", "Moorooka", "Morningside",
    "Mount Coot-tha", "Mount Gravatt", "Mount Gravatt East", "Mount Ommaney", "Murarrie", "Nathan", "New Farm", "Newmarket", "Newstead", "Norman Park",
    "Northgate", "Nudgee", "Nudgee Beach", "Nundah", "Oxley", "Paddington", "Pallara", "Parkinson", "Petrie Terrace", "Pinjarra Hills",
    "Pinkenba", "Port of Brisbane", "Pullenvale", "Ransome", "Red Hill", "Richlands", "Riverhills", "Robertson", "Rochedale", "Rocklea",
    "Runcorn", "Salisbury", "Sandgate", "Seven Hills", "Seventeen Mile Rocks", "Sherwood", "Shorncliffe", "Sinnamon Park", "South Brisbane", "Spring Hill",
    "St Lucia", "Stafford", "Stafford Heights", "Stones Corner", "Stretton", "Sumner", "Sunnybank", "Sunnybank Hills", "Taigum", "Taringa",
    "Tarragindi", "Tennyson", "The Gap", "Tingalpa", "Toowong", "Upper Brookfield", "Upper Kedron", "Upper Mount Gravatt", "Virginia", "Wacol",
    "Wakerley", "Wavell Heights", "West End", "Westlake", "Willawong", "Wilston", "Windsor", "Wishart", "Woolloongabba", "Wooloowin",
    "Wynnum", "Wynnum West", "Yeerongpilly", "Yeronga", "Zillmere"
];

const loganCitySuburbs = [
    "Heritage Park", "Crestmead", "Browns Plains", "Regents Park",
    "Greenbank", "New Beith", "Hillcrest", "Boronia Heights", "Forestdale",
    "Veresdale Scrub", "Veresdale", "Cedar Vale", "Mundoolun", "Cedar Grove",
    "Woodhill", "North Maclean", "South Maclean", "Jimboomba", "Riverbend",
    "Glenlogan", "Flagstone", "Munruben", "Park Ridge", "Park Ridge South",
    "Stockleigh", "Chambers Flat", "Buccan", "Logan Village", "Yarrabilba",
    "Tamborine", "Cedar Creek", "Kairabah", "Logan Reserve", "Waterford",
    "Waterford West", "Rochedale South", "Priestdale", "Springwood", "Underwood",
    "Daisy Hill", "Shailer Park", "Carbrook", "Cornubia", "Loganholme", "Tanah Merah"
];

const allSuburbs = [...new Set([...brisbaneCitySuburbs, ...loganCitySuburbs])];

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeDate(dateString) {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date;
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        log('LocalStorage error:', e);
    }
}

function safeLocalStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        log('LocalStorage error:', e);
        return null;
    }
}

function showButtonLoading(button, loadingText = 'Loading...') {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
}

function hideButtonLoading(button) {
    button.disabled = false;
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

// Data Fetching
function fetchData() {
    log('Fetching data...');
    const brisbaneFetch = fetch('dataset/kerbside-large-item-collection-schedule.json').then(response => response.json());
    const loganFetch = fetch('dataset/Kerbside-cleanup-logan.json').then(response => response.json());

    return Promise.all([brisbaneFetch, loganFetch])
        .then(([brisbaneData, loganData]) => {
            brisbaneData = brisbaneData.map(item => ({...item, source: 'Brisbane'}));
            loganData = loganData.map(item => ({...item, source: 'Logan'}));

            allData = [...brisbaneData, ...loganData];
            log('Data fetched, length:', allData.length);

            if (!allData || allData.length === 0) {
                throw new Error('No data received');
            }

            document.getElementById('loading').style.display = 'none';
            document.getElementById('dataContainer').classList.remove('hidden');
            document.getElementById('dataContainer').style.display = 'grid';
            populateWeekFilter();
            renderCards(allData);
            return allData;
        })
        .catch(error => {
            log('Error in fetchData:', error);
            document.getElementById('loading').style.display = 'none';
            const errorDiv = document.getElementById('error');
            errorDiv.classList.remove('hidden');
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Error loading data. Please refresh the page or try again later.';
            throw error;
        });
}

function populateWeekFilter() {
    const weekFilter = document.getElementById('weekFilter');
    const weeks = [...new Set(allData.map(item => item.week))].sort((a, b) => a - b);
    weekFilter.innerHTML = '<option value="">All Weeks</option>';
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Week ${week}`;
        weekFilter.appendChild(option);
    });
}

// Skeleton Loading
function showSkeletonLoading() {
    const dataContainer = document.getElementById('dataContainer');
    if (!dataContainer) return;

    const isMobile = window.innerWidth <= 768;
    const skeletonCount = isMobile ? 3 : 6;

    dataContainer.innerHTML = '';
    dataContainer.classList.remove('hidden');
    dataContainer.style.display = 'grid';

    for (let i = 0; i < skeletonCount; i++) {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton skeleton-line title"></div>
            <div class="skeleton skeleton-line text"></div>
            <div class="skeleton skeleton-line small"></div>
            <div class="skeleton skeleton-line text"></div>
            <div class="skeleton skeleton-line small"></div>
        `;
        dataContainer.appendChild(skeletonCard);
    }

    // Hide loading spinner
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
}

function hideSkeletonLoading() {
    // Skeleton will be replaced by actual cards in renderCards
}

// Rendering Functions
function renderCards(data) {
    log('renderCards called with', data.length, 'items');
    const dataContainer = document.getElementById('dataContainer');

    if (!dataContainer) {
        log('Data container not found');
        return;
    }

    dataContainer.innerHTML = '';

    // Show empty state if no data
    if (data.length === 0) {
        dataContainer.style.display = 'block';
        dataContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No results found. Try adjusting your filters.</p>
            </div>
        `;
        document.getElementById('pagination').style.display = 'none';
        return;
    }

    dataContainer.style.display = 'grid';

    const startIndex = (currentPage - 1) * CONFIG.PAGINATION.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.PAGINATION.ITEMS_PER_PAGE;
    const pageData = data.slice(startIndex, endIndex);

    const currentDate = normalizeDate(new Date());

    pageData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        if (item.isPlaceholder) {
            card.innerHTML = `
                <h3><i class="fas fa-map-marker-alt"></i> ${item.suburb}</h3>
                <p>No collection data available for this suburb.</p>
            `;
        } else {
            const collectionDate = normalizeDate(item.date_of_collection);
            const itemsOutDate = normalizeDate(item.items_out_on_footpath);
            const isCollectionCompleted = collectionDate < currentDate;
            const isItemsOutCompleted = itemsOutDate < currentDate;

            card.innerHTML = `
                <h3><i class="fas fa-map-marker-alt"></i> ${item.suburb}</h3>
                <p><i class="fas fa-city"></i> ${item.source} City Council</p>
                <p><i class="fas fa-calendar-week"></i> Week: ${item.week}</p>
                <p class="collection-date ${isCollectionCompleted ? 'completed' : ''}">
                    <i class="fas fa-truck"></i>
                    <strong>Collection Date:</strong> ${formatDate(item.date_of_collection)}
                    ${isCollectionCompleted ? '<i class="fas fa-check-circle completed-icon"></i>' : ''}
                </p>
                <p class="items-out-date ${isItemsOutCompleted ? 'completed' : ''}">
                    <i class="fas fa-box"></i>
                    <strong>Items Out Date:</strong> ${formatDate(item.items_out_on_footpath)}
                    ${isItemsOutCompleted ? '<i class="fas fa-check-circle completed-icon"></i>' : ''}
                </p>
                <p class="countdown" data-collection-date="${item.date_of_collection}"></p>
            `;
        }

        dataContainer.appendChild(card);
    });

    log(`Rendered ${pageData.length} cards`);
    updateCountdowns();
    renderPagination(data.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / CONFIG.PAGINATION.ITEMS_PER_PAGE);
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';

    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '←';
        prevButton.setAttribute('aria-label', 'Previous page');
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCards(filterData());
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.className = 'page-info';
        paginationContainer.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = '→';
        nextButton.setAttribute('aria-label', 'Next page');
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderCards(filterData());
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(nextButton);

        paginationContainer.classList.remove('hidden');
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.classList.add('hidden');
        paginationContainer.style.display = 'none';
    }
}

// Filtering and Sorting
function filterData() {
    log('filterData called');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const weekFilter = document.getElementById('weekFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const completionFilter = document.getElementById('completionFilter').value;
    const currentDate = normalizeDate(new Date());

    const filteredData = allData.filter(item => {
        const matchesSearch = item.suburb.toLowerCase().includes(searchTerm);
        const matchesWeek = weekFilter === '' || item.week.toString() === weekFilter;
        const matchesDate = dateFilter === '' || normalizeDate(item.date_of_collection).getTime() === normalizeDate(dateFilter).getTime();

        const collectionDate = normalizeDate(item.date_of_collection);
        const isCompleted = collectionDate < currentDate;
        const matchesCompletion = completionFilter === '' ||
            (completionFilter === 'completed' && isCompleted) ||
            (completionFilter === 'not-completed' && !isCompleted);

        // Apply stat card filter
        let matchesStatFilter = true;
        if (activeStatFilter) {
            const currentWeekStart = new Date();
            const currentWeekEnd = new Date();
            currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

            switch (activeStatFilter) {
                case 'completed':
                    matchesStatFilter = isCompleted;
                    break;
                case 'upcoming':
                    matchesStatFilter = !isCompleted;
                    break;
                case 'thisWeek':
                    const collectionDateObj = new Date(item.date_of_collection);
                    matchesStatFilter = collectionDateObj >= currentWeekStart && collectionDateObj <= currentWeekEnd;
                    break;
                default:
                    matchesStatFilter = true;
            }
        }

        return matchesSearch && matchesWeek && matchesDate && matchesCompletion && matchesStatFilter;
    });

    const matchingSuburbs = allSuburbs.filter(suburb =>
        suburb.toLowerCase().includes(searchTerm)
    );

    const placeholderData = matchingSuburbs
        .filter(suburb => !filteredData.some(item => item.suburb.toLowerCase() === suburb.toLowerCase()))
        .map(suburb => ({
            suburb: suburb,
            week: 'N/A',
            date_of_collection: 'N/A',
            items_out_on_footpath: 'N/A',
            isPlaceholder: true,
            source: 'Unknown'
        }));

    const combinedData = [...filteredData, ...placeholderData];
    log('Combined data length:', combinedData.length);
    return combinedData;
}

function sortData(data) {
    const sortOption = document.getElementById('sortOption').value;
    return data.sort((a, b) => {
        if (a.isPlaceholder) return 1;
        if (b.isPlaceholder) return -1;

        switch (sortOption) {
            case 'suburb':
                return a.suburb.localeCompare(b.suburb);
            case 'date':
                return new Date(a.date_of_collection) - new Date(b.date_of_collection);
            case 'week':
                return a.week - b.week;
            default:
                return 0;
        }
    });
}

function filterAndSortData() {
    log('filterAndSortData called');
    currentPage = 1; // Reset to first page
    let filteredData = filterData();
    filteredData = sortData(filteredData);
    renderCards(filteredData);
    updateCountdowns();
}

// Debounced version for search input
const debouncedFilterAndSort = debounce(filterAndSortData, CONFIG.DEBOUNCE_DELAY);

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterAndSortData();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('weekFilter').value = '';
    document.getElementById('dateFilter').value = '';
    document.getElementById('completionFilter').value = '';
    activeStatFilter = null;
    updateStatCardActiveStates();
    currentPage = 1;
    renderCards(allData);
}

// Stat Card Interactivity
function handleStatCardClick(filterType) {
    log('Stat card clicked:', filterType);

    // If clicking the same card, clear the filter
    if (activeStatFilter === filterType) {
        activeStatFilter = null;
    } else {
        activeStatFilter = filterType;
    }

    updateStatCardActiveStates();
    filterAndSortData();
}

function updateStatCardActiveStates() {
    // Remove active class from all stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });

    // Add active class to the active stat card
    if (activeStatFilter) {
        const activeCard = document.querySelector(`.stat-card[data-filter="${activeStatFilter}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
    }
}

// Chart Toggle
function toggleCharts() {
    const chartsSection = document.querySelector('.charts-grid');
    const toggleButton = document.getElementById('toggleCharts');
    const toggleIcon = toggleButton.querySelector('i');

    if (chartsSection.classList.contains('collapsed')) {
        chartsSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide Charts ';
        toggleIcon.className = 'fas fa-chevron-up';
        toggleButton.appendChild(toggleIcon);
        safeLocalStorageSet('chartsCollapsed', 'false');
    } else {
        chartsSection.classList.add('collapsed');
        toggleButton.textContent = 'Show Charts ';
        toggleIcon.className = 'fas fa-chevron-down';
        toggleButton.appendChild(toggleIcon);
        safeLocalStorageSet('chartsCollapsed', 'true');
    }
}

// Suburb List Population
function populateSuburbList() {
    log('populateSuburbList called');
    let suburbList = document.getElementById('suburbList');

    if (!suburbList) {
        log('Creating suburbList element');
        suburbList = document.createElement('datalist');
        suburbList.id = 'suburbList';
        document.body.appendChild(suburbList);
    }

    suburbList.innerHTML = '';

    allSuburbs.forEach(suburb => {
        const option = document.createElement('option');
        option.value = suburb;
        suburbList.appendChild(option);
    });

    log('Suburb list populated with', allSuburbs.length, 'suburbs');
}

// Preferences
function savePreferences() {
    const preferences = {
        searchTerm: document.getElementById('searchInput').value,
        weekFilter: document.getElementById('weekFilter').value,
        dateFilter: document.getElementById('dateFilter').value,
        completionFilter: document.getElementById('completionFilter').value,
        sortOption: document.getElementById('sortOption').value
    };
    safeLocalStorageSet('kerbsidePreferences', JSON.stringify(preferences));
}

function loadPreferences() {
    const preferencesStr = safeLocalStorageGet('kerbsidePreferences');
    if (preferencesStr) {
        try {
            const preferences = JSON.parse(preferencesStr);
            document.getElementById('searchInput').value = preferences.searchTerm || '';
            document.getElementById('weekFilter').value = preferences.weekFilter || '';
            document.getElementById('dateFilter').value = preferences.dateFilter || '';
            document.getElementById('completionFilter').value = preferences.completionFilter || '';
            document.getElementById('sortOption').value = preferences.sortOption || 'suburb';
            filterAndSortData();
        } catch (e) {
            log('Error parsing preferences:', e);
        }
    }
}

// Countdown Timer
function updateCountdowns() {
    log('Updating countdowns');
    const countdownElements = document.querySelectorAll('.countdown');
    const now = new Date();

    countdownElements.forEach((element) => {
        if (!element.dataset.collectionDate) {
            return;
        }

        const collectionDate = new Date(element.dataset.collectionDate);
        const timeLeft = collectionDate - now;

        if (timeLeft > 0) {
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            element.textContent = `Next collection in: ${days} days, ${hours} hours, ${minutes} minutes`;
        } else {
            element.textContent = 'Collection has already occurred';
        }
    });
}

// Calendar Export Functions
function generateICS(collections, filename = 'kerbside_collection.ics') {
    if (!collections || collections.length === 0) {
        alert('No collections to export');
        return;
    }

    // RFC 5545 iCalendar format
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kerbside Collection Schedule//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Kerbside Collection Schedule',
        'X-WR-TIMEZONE:Australia/Brisbane',
        'X-WR-CALDESC:Brisbane and Logan City Council kerbside collection schedule'
    ];

    collections.forEach(item => {
        if (item.isPlaceholder) return;

        const collectionDate = new Date(item.date_of_collection);
        const itemsOutDate = new Date(item.items_out_on_footpath);

        // Format dates for iCalendar (YYYYMMDD)
        const formatICSDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        };

        // Generate unique ID
        const uid = `${item.suburb}-${item.week}-${formatICSDate(collectionDate)}@kerbside-schedule.local`;

        // Collection Day Event
        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${uid}`);
        icsContent.push(`DTSTAMP:${formatICSDate(new Date())}T000000Z`);
        icsContent.push(`DTSTART;VALUE=DATE:${formatICSDate(collectionDate)}`);
        icsContent.push(`SUMMARY:Kerbside Collection - ${item.suburb}`);
        icsContent.push(`DESCRIPTION:Kerbside cleanup collection for ${item.suburb} (Week ${item.week})\\n${item.source} City Council\\n\\nPut items out by: ${formatDate(item.items_out_on_footpath)}`);
        icsContent.push(`LOCATION:${item.suburb}, Queensland, Australia`);
        icsContent.push('STATUS:CONFIRMED');
        icsContent.push('TRANSP:TRANSPARENT');
        icsContent.push('END:VEVENT');

        // Reminder Event (Items Out Date)
        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${uid}-reminder`);
        icsContent.push(`DTSTAMP:${formatICSDate(new Date())}T000000Z`);
        icsContent.push(`DTSTART;VALUE=DATE:${formatICSDate(itemsOutDate)}`);
        icsContent.push(`SUMMARY:Put Items Out - ${item.suburb}`);
        icsContent.push(`DESCRIPTION:Reminder: Put kerbside collection items out today for collection on ${formatDate(item.date_of_collection)}\\n${item.source} City Council`);
        icsContent.push(`LOCATION:${item.suburb}, Queensland, Australia`);
        icsContent.push('STATUS:CONFIRMED');
        icsContent.push('TRANSP:TRANSPARENT');
        icsContent.push('BEGIN:VALARM');
        icsContent.push('TRIGGER:-PT1H');
        icsContent.push('ACTION:DISPLAY');
        icsContent.push(`DESCRIPTION:Put items out for kerbside collection`);
        icsContent.push('END:VALARM');
        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    // Create and download file
    const icsString = icsContent.join('\r\n');
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function exportToCalendar() {
    const filteredData = filterData().filter(item => !item.isPlaceholder);
    if (filteredData.length === 0) {
        alert('No collections to export. Try adjusting your filters.');
        return;
    }
    generateICS(filteredData, 'kerbside_collection_schedule.ics');
}

function exportSuburbToCalendar(suburb) {
    const suburbData = allData.filter(item => item.suburb === suburb && !item.isPlaceholder);
    if (suburbData.length === 0) {
        alert(`No collection data found for ${suburb}`);
        return;
    }
    generateICS(suburbData, `${suburb.replace(/\s+/g, '_')}_collection.ics`);
}

// Export Functions
function waitForJsPDF(callback) {
    if (window.jspdf) {
        callback();
    } else {
        setTimeout(() => waitForJsPDF(callback), 100);
    }
}

function exportToPDF() {
    const button = document.getElementById('exportPDF');
    showButtonLoading(button, 'Exporting...');

    waitForJsPDF(() => {
        try {
            const { jsPDF } = window.jspdf;
            const filteredData = filterData();
            const doc = new jsPDF();

            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(44, 62, 80);
            doc.text("Kerbside Collection Schedule", 105, 15, null, null, "center");

            doc.addImage("https://s3-ap-southeast-2.amazonaws.com/aws-ec2-ap-southeast-2-opendatasoft-staticfileset/prod-brisbane-queensland/logo?tstamp=17101930999905946", "PNG", 10, 5, 20, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 195, 10, null, null, "right");

            doc.setLineWidth(0.5);
            doc.line(10, 25, 200, 25);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(0);

            let yPos = 35;
            filteredData.forEach((item, index) => {
                if (item.isPlaceholder) return;

                doc.setFont("helvetica", "bold");
                doc.setFontSize(14);
                doc.setTextColor(41, 128, 185);
                doc.text(`${item.suburb} - Week ${item.week}`, 10, yPos);
                yPos += 7;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text(`Collection Date: ${formatDate(item.date_of_collection)}`, 15, yPos);
                yPos += 6;
                doc.text(`Items Out Date: ${formatDate(item.items_out_on_footpath)}`, 15, yPos);
                yPos += 10;

                doc.setDrawColor(200);
                doc.line(10, yPos - 5, 200, yPos - 5);
                yPos += 5;

                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            });

            const pageCount = doc.internal.getNumberOfPages();
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.text(`Page ${i} of ${pageCount}`, 105, 290, null, null, "center");
            }

            doc.save(CONFIG.EXPORT.PDF_FILENAME);
        } catch (error) {
            log('PDF export error:', error);
            alert('Error exporting PDF. Please try again.');
        } finally {
            hideButtonLoading(button);
        }
    });
}

function exportToCSV() {
    const button = document.getElementById('exportCSV');
    showButtonLoading(button, 'Exporting...');

    try {
        const filteredData = filterData().filter(item => !item.isPlaceholder);
        let csvContent = "data:text/csv;charset=utf-8,";

        csvContent += "Suburb,Week,Collection Date,Items Out Date,Council\n";

        filteredData.forEach(item => {
            const collectionDate = formatDate(item.date_of_collection);
            const itemsOutDate = formatDate(item.items_out_on_footpath);
            const row = `${item.suburb},${item.week},${collectionDate},${itemsOutDate},${item.source}`;
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", CONFIG.EXPORT.CSV_FILENAME);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        log('CSV export error:', error);
        alert('Error exporting CSV. Please try again.');
    } finally {
        hideButtonLoading(button);
    }
}

// Feedback Form
function handleFeedback(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');

    showButtonLoading(submitButton, 'Sending...');

    fetch(form.action, {
        method: form.method,
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            alert('Thank you for your feedback!');
            form.reset();
        } else {
            response.json().then(data => {
                if (Object.hasOwn(data, 'errors')) {
                    alert(data["errors"].map(error => error["message"]).join(", "));
                } else {
                    alert("There was a problem submitting your form. Please try again.");
                }
            });
        }
    }).catch(error => {
        log('Feedback error:', error);
        alert("There was a problem submitting your form. Please try again.");
    }).finally(() => {
        hideButtonLoading(submitButton);
    });
}

// Historical Data
function populateHistoricalSuburbs() {
    const suburbSelect = document.getElementById('historicalSuburb');
    const uniqueSuburbs = [...new Set(allData.map(item => item.suburb))].sort();

    uniqueSuburbs.forEach(suburb => {
        const option = document.createElement('option');
        option.value = suburb;
        option.textContent = suburb;
        suburbSelect.appendChild(option);
    });
}

function updateHistoricalStats() {
    const selectedSuburb = document.getElementById('historicalSuburb').value;

    if (!selectedSuburb) {
        document.getElementById('historicalStats').innerHTML = '';
        return;
    }

    const suburbData = allData.filter(item => item.suburb === selectedSuburb);

    const stats = suburbData.reduce((acc, item) => {
        const year = new Date(item.date_of_collection).getFullYear();
        if (!acc[year]) acc[year] = 0;
        acc[year]++;
        return acc;
    }, {});

    let statsHtml = '<h3>Collection Statistics for ' + selectedSuburb + '</h3>';
    for (const [year, count] of Object.entries(stats)) {
        statsHtml += `<p>${year}: ${count} collection${count !== 1 ? 's' : ''}</p>`;
    }

    document.getElementById('historicalStats').innerHTML = statsHtml;
}

// Notification handling
function initNotification() {
    const notification = document.getElementById('notification');
    const closeNotification = document.getElementById('closeNotification');

    if (closeNotification) {
        closeNotification.addEventListener('click', () => {
            notification.style.display = 'none';
            safeLocalStorageSet('loganNotification2025Closed', 'true');
        });
    }

    if (safeLocalStorageGet('loganNotification2025Closed') !== 'true') {
        notification.style.display = 'flex';

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (notification.style.display !== 'none') {
                notification.style.display = 'none';
                safeLocalStorageSet('loganNotification2025Closed', 'true');
            }
        }, 10000);
    } else {
        notification.style.display = 'none';
    }
}

// Multi-Suburb Tracking System
function loadTrackedSuburbs() {
    const saved = safeLocalStorageGet('trackedSuburbs');
    if (saved) {
        try {
            trackedSuburbs = JSON.parse(saved);
            log('Loaded tracked suburbs:', trackedSuburbs);
        } catch (e) {
            log('Error parsing tracked suburbs:', e);
            trackedSuburbs = [];
        }
    }
    updateTrackedSuburbsUI();
}

function saveTrackedSuburbs() {
    safeLocalStorageSet('trackedSuburbs', JSON.stringify(trackedSuburbs));
}

function addTrackedSuburb(suburb) {
    if (!suburb || suburb.trim() === '') {
        alert('Please select a suburb');
        return;
    }

    if (trackedSuburbs.includes(suburb)) {
        alert(`${suburb} is already being tracked`);
        return;
    }

    trackedSuburbs.push(suburb);
    saveTrackedSuburbs();
    updateTrackedSuburbsUI();
    log('Added tracked suburb:', suburb);
}

function removeTrackedSuburb(suburb) {
    trackedSuburbs = trackedSuburbs.filter(s => s !== suburb);
    if (activeTrackedSuburb === suburb) {
        activeTrackedSuburb = null;
        document.getElementById('searchInput').value = '';
        filterAndSortData();
    }
    saveTrackedSuburbs();
    updateTrackedSuburbsUI();
    log('Removed tracked suburb:', suburb);
}

function setActiveTrackedSuburb(suburb) {
    activeTrackedSuburb = suburb;
    document.getElementById('searchInput').value = suburb;
    filterAndSortData();
    updateTrackedSuburbsUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTrackedSuburbsUI() {
    const container = document.getElementById('trackedSuburbsList');
    if (!container) return;

    if (trackedSuburbs.length === 0) {
        container.innerHTML = '<p class="no-tracked-suburbs">No suburbs tracked yet. Add your first suburb above!</p>';
        return;
    }

    container.innerHTML = '';
    trackedSuburbs.forEach(suburb => {
        const suburbData = allData.filter(item => item.suburb === suburb && !item.isPlaceholder);
        const nextCollection = suburbData
            .filter(item => new Date(item.date_of_collection) >= new Date())
            .sort((a, b) => new Date(a.date_of_collection) - new Date(b.date_of_collection))[0];

        const card = document.createElement('div');
        card.className = `tracked-suburb-card ${activeTrackedSuburb === suburb ? 'active' : ''}`;

        card.innerHTML = `
            <div class="tracked-suburb-header">
                <h4>${suburb}</h4>
                <button class="tracked-suburb-remove" aria-label="Remove ${suburb}" title="Remove ${suburb}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tracked-suburb-info">
                ${nextCollection ? `
                    <p class="next-collection">
                        <i class="fas fa-calendar-alt"></i>
                        <strong>Next:</strong> ${formatDate(nextCollection.date_of_collection)}
                    </p>
                    <p class="items-out">
                        <i class="fas fa-box"></i>
                        <strong>Items out:</strong> ${formatDate(nextCollection.items_out_on_footpath)}
                    </p>
                ` : '<p class="no-upcoming">No upcoming collections</p>'}
            </div>
            <div class="tracked-suburb-actions">
                <button class="btn-view" title="View collections for ${suburb}">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn-export-calendar" title="Export ${suburb} to calendar">
                    <i class="fas fa-calendar-plus"></i> Calendar
                </button>
                <button class="btn-share" title="Share ${suburb} schedule">
                    <i class="fas fa-share-alt"></i> Share
                </button>
            </div>
        `;

        // Add event listeners
        card.querySelector('.tracked-suburb-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Remove ${suburb} from tracked suburbs?`)) {
                removeTrackedSuburb(suburb);
            }
        });

        card.querySelector('.btn-view').addEventListener('click', () => {
            setActiveTrackedSuburb(suburb);
        });

        card.querySelector('.btn-export-calendar').addEventListener('click', () => {
            exportSuburbToCalendar(suburb);
        });

        card.querySelector('.btn-share').addEventListener('click', () => {
            shareSuburbSchedule(suburb);
        });

        container.appendChild(card);
    });
}

function initTrackedSuburbsSystem() {
    loadTrackedSuburbs();

    const addButton = document.getElementById('addTrackedSuburb');
    const suburbSelect = document.getElementById('trackSuburbSelect');

    if (addButton && suburbSelect) {
        addButton.addEventListener('click', () => {
            const suburb = suburbSelect.value;
            if (suburb) {
                addTrackedSuburb(suburb);
                suburbSelect.value = '';
            }
        });
    }
}

function populateTrackSuburbSelect() {
    const select = document.getElementById('trackSuburbSelect');
    if (!select) return;

    const uniqueSuburbs = [...new Set(allData.map(item => item.suburb))].sort();
    select.innerHTML = '<option value="">Select a suburb to track</option>';
    uniqueSuburbs.forEach(suburb => {
        const option = document.createElement('option');
        option.value = suburb;
        option.textContent = suburb;
        select.appendChild(option);
    });
}

// Share & Collaboration Features
function shareSuburbSchedule(suburb) {
    const url = `${window.location.origin}${window.location.pathname}?suburb=${encodeURIComponent(suburb)}`;

    if (navigator.share) {
        // Use Web Share API if available
        navigator.share({
            title: `${suburb} Kerbside Collection Schedule`,
            text: `Check out the kerbside collection schedule for ${suburb}`,
            url: url
        }).catch(err => log('Error sharing:', err));
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            showShareModal(suburb, url);
        }).catch(err => {
            log('Error copying to clipboard:', err);
            showShareModal(suburb, url);
        });
    }
}

function showShareModal(suburb, url) {
    const modal = document.getElementById('shareModal');
    const suburbName = document.getElementById('shareSuburbName');
    const shareUrl = document.getElementById('shareUrl');
    const copyBtn = document.getElementById('copyShareUrl');

    if (!modal) return;

    if (suburbName) suburbName.textContent = suburb;
    shareUrl.value = url;
    modal.style.display = 'flex';

    copyBtn.onclick = () => {
        shareUrl.select();
        navigator.clipboard.writeText(url).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
            }, 2000);
        });
    };
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.style.display = 'none';
}

function printSchedule() {
    window.print();
}

// Check URL parameters for shared suburb
function checkURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const suburb = params.get('suburb');

    if (suburb) {
        log('Suburb from URL:', suburb);
        document.getElementById('searchInput').value = suburb;
        filterAndSortData();

        // Scroll to results
        setTimeout(() => {
            document.querySelector('.search-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }
}

// PWA Install Prompt & Service Worker
function initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                    log('[PWA] Service Worker registered:', registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Check every hour
                })
                .catch((error) => {
                    log('[PWA] Service Worker registration failed:', error);
                });
        });

        // Handle service worker updates
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            log('[PWA] New service worker activated');
            // Optionally show update notification to user
        });
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        log('[PWA] Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    // Track installation
    window.addEventListener('appinstalled', () => {
        log('[PWA] App installed');
        hideInstallButton();
        deferredPrompt = null;

        // Show success message
        showNotification('App installed successfully! You can now use it offline.', 'success');
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        log('[PWA] Running as installed app');
        hideInstallButton();
    }
}

function showInstallButton() {
    const installButton = document.getElementById('installApp');
    if (installButton) {
        installButton.style.display = 'inline-flex';
    }
}

function hideInstallButton() {
    const installButton = document.getElementById('installApp');
    if (installButton) {
        installButton.style.display = 'none';
    }
}

async function installApp() {
    if (!deferredPrompt) {
        log('[PWA] Install prompt not available');
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    log('[PWA] User response:', outcome);

    if (outcome === 'accepted') {
        log('[PWA] User accepted install');
    } else {
        log('[PWA] User dismissed install');
    }

    // Clear the prompt
    deferredPrompt = null;
}

function showNotification(message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `pwa-notification pwa-notification-${type}`;
    notificationDiv.innerHTML = `
        <div class="pwa-notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" aria-label="Close notification">
            &times;
        </button>
    `;

    document.body.appendChild(notificationDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notificationDiv.remove();
    }, 5000);
}

// Check online/offline status
function initOnlineStatus() {
    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            log('[PWA] Online');
            document.body.classList.remove('offline');
        } else {
            log('[PWA] Offline');
            document.body.classList.add('offline');
            showNotification('You are offline. Using cached data.', 'info');
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

// Collection Reminder System
function initReminderSystem() {
    const savedSuburb = safeLocalStorageGet('reminderSuburb');
    const reminderSelect = document.getElementById('reminderSuburb');
    const enableReminderBtn = document.getElementById('enableReminder');
    const disableReminderBtn = document.getElementById('disableReminder');
    const reminderStatus = document.getElementById('reminderStatus');

    if (savedSuburb && reminderSelect) {
        reminderSelect.value = savedSuburb;
        updateReminderStatus(savedSuburb);
    }

    if (enableReminderBtn) {
        enableReminderBtn.addEventListener('click', () => {
            const selectedSuburb = reminderSelect.value;
            if (selectedSuburb) {
                safeLocalStorageSet('reminderSuburb', selectedSuburb);
                updateReminderStatus(selectedSuburb);
                checkUpcomingCollection(selectedSuburb);
            }
        });
    }

    if (disableReminderBtn) {
        disableReminderBtn.addEventListener('click', () => {
            localStorage.removeItem('reminderSuburb');
            if (reminderSelect) reminderSelect.value = '';
            updateReminderStatus(null);
            hideCollectionReminder();
        });
    }

    // Check for upcoming collection on load
    if (savedSuburb) {
        checkUpcomingCollection(savedSuburb);
    }
}

function updateReminderStatus(suburb) {
    const reminderStatus = document.getElementById('reminderStatus');
    const enableBtn = document.getElementById('enableReminder');
    const disableBtn = document.getElementById('disableReminder');

    if (suburb) {
        reminderStatus.innerHTML = `<i class="fas fa-bell"></i> Reminders enabled for <strong>${suburb}</strong>`;
        reminderStatus.className = 'reminder-status active';
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'inline-flex';
    } else {
        reminderStatus.innerHTML = '<i class="fas fa-bell-slash"></i> No reminders set';
        reminderStatus.className = 'reminder-status';
        if (enableBtn) enableBtn.style.display = 'inline-flex';
        if (disableBtn) disableBtn.style.display = 'none';
    }
}

function checkUpcomingCollection(suburb) {
    const suburbData = allData.filter(item => item.suburb === suburb);
    if (suburbData.length === 0) return;

    const currentDate = normalizeDate(new Date());
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);

    // Find next collection
    const upcomingCollections = suburbData
        .filter(item => {
            const collectionDate = normalizeDate(item.date_of_collection);
            return collectionDate >= currentDate;
        })
        .sort((a, b) => new Date(a.date_of_collection) - new Date(b.date_of_collection));

    if (upcomingCollections.length > 0) {
        const nextCollection = upcomingCollections[0];
        const collectionDate = normalizeDate(nextCollection.date_of_collection);
        const itemsOutDate = normalizeDate(nextCollection.items_out_on_footpath);

        // Check if collection is within 3 days
        if (collectionDate <= threeDaysFromNow) {
            showCollectionReminder(nextCollection);
        }
    }
}

function showCollectionReminder(collectionData) {
    const reminderBanner = document.getElementById('collectionReminder');
    if (!reminderBanner) return;

    const collectionDate = formatDate(collectionData.date_of_collection);
    const itemsOutDate = formatDate(collectionData.items_out_on_footpath);
    const daysUntil = Math.ceil((normalizeDate(collectionData.date_of_collection) - normalizeDate(new Date())) / (1000 * 60 * 60 * 24));

    let message = '';
    if (daysUntil === 0) {
        message = `<strong>Today!</strong> Collection for ${collectionData.suburb} is today (${collectionDate})`;
    } else if (daysUntil === 1) {
        message = `<strong>Tomorrow!</strong> Collection for ${collectionData.suburb} is tomorrow (${collectionDate}). Put items out by ${itemsOutDate}.`;
    } else {
        message = `<strong>Upcoming!</strong> Collection for ${collectionData.suburb} is in ${daysUntil} days (${collectionDate}). Put items out by ${itemsOutDate}.`;
    }

    document.getElementById('reminderMessage').innerHTML = message;
    reminderBanner.style.display = 'flex';
}

function hideCollectionReminder() {
    const reminderBanner = document.getElementById('collectionReminder');
    if (reminderBanner) {
        reminderBanner.style.display = 'none';
    }
}

function populateReminderSuburbs() {
    const reminderSelect = document.getElementById('reminderSuburb');
    if (!reminderSelect) return;

    const uniqueSuburbs = [...new Set(allData.map(item => item.suburb))].sort();

    reminderSelect.innerHTML = '<option value="">Select your suburb</option>';
    uniqueSuburbs.forEach(suburb => {
        const option = document.createElement('option');
        option.value = suburb;
        option.textContent = suburb;
        reminderSelect.appendChild(option);
    });
}

// Data Visualizations
let charts = {
    weekly: null,
    council: null,
    progress: null,
    monthly: null
};

function updateStatistics() {
    const currentDate = normalizeDate(new Date());
    const currentWeekStart = new Date();
    const currentWeekEnd = new Date();
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

    // Calculate statistics
    const uniqueSuburbs = [...new Set(allData.map(item => item.suburb))];
    const completed = allData.filter(item => normalizeDate(item.date_of_collection) < currentDate);
    const upcoming = allData.filter(item => normalizeDate(item.date_of_collection) >= currentDate);
    const thisWeek = allData.filter(item => {
        const collectionDate = new Date(item.date_of_collection);
        return collectionDate >= currentWeekStart && collectionDate <= currentWeekEnd;
    });

    // Update stat cards with animation
    animateValue('totalSuburbs', 0, uniqueSuburbs.length, 1000);
    animateValue('completedCollections', 0, completed.length, 1000);
    animateValue('upcomingCollections', 0, upcoming.length, 1000);
    animateValue('thisWeekCollections', 0, thisWeek.length, 1000);
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = Math.round(end);
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

function initCharts() {
    if (typeof Chart === 'undefined') {
        log('Chart.js not loaded');
        return;
    }

    // Chart.js default configuration
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";
    Chart.defaults.color = 'hsl(215.4, 16.3%, 46.9%)';

    createWeeklyDistributionChart();
    createCouncilComparisonChart();
    createProgressChart();
    createMonthlyDistributionChart();
}

function createWeeklyDistributionChart() {
    const ctx = document.getElementById('weeklyDistributionChart');
    if (!ctx) return;

    // Group data by week
    const weekData = {};
    allData.forEach(item => {
        weekData[item.week] = (weekData[item.week] || 0) + 1;
    });

    const weeks = Object.keys(weekData).sort((a, b) => parseInt(a) - parseInt(b));
    const counts = weeks.map(week => weekData[week]);

    if (charts.weekly) {
        charts.weekly.destroy();
    }

    charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => `Week ${w}`),
            datasets: [{
                label: 'Collections',
                data: counts,
                backgroundColor: 'hsl(221.2, 83.2%, 53.3%, 0.8)',
                borderColor: 'hsl(221.2, 83.2%, 53.3%)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'hsl(222.2, 47.4%, 11.2%)',
                    padding: 12,
                    borderRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 600
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'hsl(214.3, 31.8%, 91.4%)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function createCouncilComparisonChart() {
    const ctx = document.getElementById('councilComparisonChart');
    if (!ctx) return;

    const brisbaneCount = allData.filter(item => item.source === 'Brisbane').length;
    const loganCount = allData.filter(item => item.source === 'Logan').length;

    if (charts.council) {
        charts.council.destroy();
    }

    charts.council = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Brisbane City', 'Logan City'],
            datasets: [{
                data: [brisbaneCount, loganCount],
                backgroundColor: [
                    'hsl(221.2, 83.2%, 53.3%, 0.8)',
                    'hsl(142.1, 76.2%, 36.3%, 0.8)'
                ],
                borderColor: [
                    'hsl(221.2, 83.2%, 53.3%)',
                    'hsl(142.1, 76.2%, 36.3%)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 500
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'hsl(222.2, 47.4%, 11.2%)',
                    padding: 12,
                    borderRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createProgressChart() {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;

    const currentDate = normalizeDate(new Date());
    const completed = allData.filter(item => normalizeDate(item.date_of_collection) < currentDate).length;
    const upcoming = allData.length - completed;

    if (charts.progress) {
        charts.progress.destroy();
    }

    charts.progress = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Upcoming'],
            datasets: [{
                data: [completed, upcoming],
                backgroundColor: [
                    'hsl(142.1, 76.2%, 36.3%, 0.8)',
                    'hsl(214.3, 31.8%, 91.4%, 0.8)'
                ],
                borderColor: [
                    'hsl(142.1, 76.2%, 36.3%)',
                    'hsl(214.3, 31.8%, 91.4%)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 500
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'hsl(222.2, 47.4%, 11.2%)',
                    padding: 12,
                    borderRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createMonthlyDistributionChart() {
    const ctx = document.getElementById('monthlyDistributionChart');
    if (!ctx) return;

    // Group data by month
    const monthData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    allData.forEach(item => {
        const date = new Date(item.date_of_collection);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

        if (!monthData[monthKey]) {
            monthData[monthKey] = { label: monthLabel, count: 0 };
        }
        monthData[monthKey].count++;
    });

    const sortedMonths = Object.keys(monthData).sort();
    const labels = sortedMonths.map(key => monthData[key].label);
    const counts = sortedMonths.map(key => monthData[key].count);

    if (charts.monthly) {
        charts.monthly.destroy();
    }

    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Collections',
                data: counts,
                backgroundColor: 'hsl(142.1, 76.2%, 36.3%, 0.8)',
                borderColor: 'hsl(142.1, 76.2%, 36.3%)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'hsl(222.2, 47.4%, 11.2%)',
                    padding: 12,
                    borderRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 600
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    },
                    grid: {
                        color: 'hsl(214.3, 31.8%, 91.4%)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    log('DOM fully loaded and parsed');

    if (typeof window.jspdf === 'undefined') {
        log('jsPDF library not loaded. PDF export will not work.');
    }

    populateSuburbList();
    initNotification();

    const elements = {
        'searchInput': document.getElementById('searchInput'),
        'weekFilter': document.getElementById('weekFilter'),
        'dateFilter': document.getElementById('dateFilter'),
        'completionFilter': document.getElementById('completionFilter'),
        'sortOption': document.getElementById('sortOption'),
        'applyFilters': document.getElementById('applyFilters'),
        'clearFilters': document.getElementById('clearFilters'),
        'clearButton': document.getElementById('clearButton'),
        'exportCSV': document.getElementById('exportCSV'),
        'exportPDF': document.getElementById('exportPDF'),
        'feedbackForm': document.getElementById('feedbackForm'),
        'historicalSuburb': document.getElementById('historicalSuburb')
    };

    // Check if all elements exist
    for (const [id, element] of Object.entries(elements)) {
        if (!element) {
            log(`Element with id "${id}" not found`);
        }
    }

    // Add event listeners with debouncing for search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debouncedFilterAndSort);
    }
    if (elements.weekFilter) elements.weekFilter.addEventListener('change', filterAndSortData);
    if (elements.dateFilter) elements.dateFilter.addEventListener('change', filterAndSortData);
    if (elements.completionFilter) elements.completionFilter.addEventListener('change', filterAndSortData);
    if (elements.sortOption) elements.sortOption.addEventListener('change', filterAndSortData);
    if (elements.applyFilters) elements.applyFilters.addEventListener('click', filterAndSortData);
    if (elements.clearFilters) elements.clearFilters.addEventListener('click', clearFilters);
    if (elements.clearButton) elements.clearButton.addEventListener('click', clearSearch);
    if (elements.exportCSV) elements.exportCSV.addEventListener('click', exportToCSV);
    if (elements.exportPDF) elements.exportPDF.addEventListener('click', exportToPDF);
    if (elements.feedbackForm) elements.feedbackForm.addEventListener('submit', handleFeedback);
    if (elements.historicalSuburb) elements.historicalSuburb.addEventListener('change', updateHistoricalStats);

    // Save preferences on filter changes
    ['searchInput', 'weekFilter', 'dateFilter', 'completionFilter', 'sortOption'].forEach(id => {
        const element = elements[id];
        if (element) {
            element.addEventListener('change', savePreferences);
        }
    });

    // Initialize stat card click handlers
    document.querySelectorAll('.stat-card').forEach(card => {
        const filterType = card.getAttribute('data-filter');
        if (filterType) {
            card.addEventListener('click', () => handleStatCardClick(filterType));
            card.style.cursor = 'pointer';
        }
    });

    // Initialize chart toggle
    const toggleButton = document.getElementById('toggleCharts');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleCharts);
    }

    // Initialize export to calendar button
    const exportCalendarBtn = document.getElementById('exportCalendar');
    if (exportCalendarBtn) {
        exportCalendarBtn.addEventListener('click', exportToCalendar);
    }

    // Initialize print button
    const printBtn = document.getElementById('printSchedule');
    if (printBtn) {
        printBtn.addEventListener('click', printSchedule);
    }

    // Initialize share modal close
    const closeShareBtn = document.getElementById('closeShareModal');
    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', closeShareModal);
    }

    // Check URL parameters for shared suburb link
    checkURLParameters();

    // Initialize PWA features
    initPWA();
    initOnlineStatus();

    // Initialize install app button
    const installAppBtn = document.getElementById('installApp');
    if (installAppBtn) {
        installAppBtn.addEventListener('click', installApp);
    }

    // Show skeleton loading on initial load
    showSkeletonLoading();

    fetchData()
        .then(() => {
            loadPreferences();
            filterAndSortData();
            setInterval(updateCountdowns, CONFIG.PAGINATION.UPDATE_INTERVAL);
            populateHistoricalSuburbs();

            // Initialize data visualizations
            updateStatistics();
            initCharts();

            // Initialize reminder system
            populateReminderSuburbs();
            initReminderSystem();

            // Initialize multi-suburb tracking
            populateTrackSuburbSelect();
            initTrackedSuburbsSystem();

            // Restore chart collapsed state or collapse by default on mobile
            const chartsCollapsed = safeLocalStorageGet('chartsCollapsed');
            const isMobile = window.innerWidth <= 768;
            const shouldCollapse = chartsCollapsed === 'true' || (chartsCollapsed === null && isMobile);

            if (shouldCollapse) {
                const chartsSection = document.querySelector('.charts-grid');
                const toggleButton = document.getElementById('toggleCharts');
                if (chartsSection && toggleButton) {
                    chartsSection.classList.add('collapsed');
                    toggleButton.textContent = 'Show Charts ';
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-chevron-down';
                    toggleButton.appendChild(icon);
                }
            }

            // Initialize bottom navigation
            initBottomNavigation();

            // Initialize pull to refresh
            initPullToRefresh();
        })
        .catch(error => log('Failed to initialize:', error));
});

// ============================================
// Pull to Refresh
// ============================================

function initPullToRefresh() {
    // Only enable on mobile devices
    if (window.innerWidth > 768) return;

    const pullToRefreshEl = document.getElementById('pullToRefresh');
    const pullToRefreshText = pullToRefreshEl.querySelector('.pull-to-refresh-text');

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const pullThreshold = 80; // Pixels to pull before triggering refresh

    // Touch start
    document.addEventListener('touchstart', (e) => {
        // Only activate if at top of page
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
            isPulling = true;
        }
    }, { passive: true });

    // Touch move
    document.addEventListener('touchmove', (e) => {
        if (!isPulling) return;

        currentY = e.touches[0].pageY;
        const pullDistance = currentY - startY;

        // User is pulling down
        if (pullDistance > 0 && window.scrollY === 0) {
            e.preventDefault();

            // Update indicator position
            const pullAmount = Math.min(pullDistance, pullThreshold);
            pullToRefreshEl.style.top = `${pullAmount - 80}px`;

            // Update state based on pull distance
            if (pullDistance < pullThreshold) {
                pullToRefreshEl.classList.remove('release');
                pullToRefreshEl.classList.add('pulling');
                pullToRefreshText.textContent = 'Pull to refresh';
            } else {
                pullToRefreshEl.classList.remove('pulling');
                pullToRefreshEl.classList.add('release');
                pullToRefreshText.textContent = 'Release to refresh';
            }
        }
    }, { passive: false });

    // Touch end
    document.addEventListener('touchend', () => {
        if (!isPulling) return;

        const pullDistance = currentY - startY;

        // Trigger refresh if pulled past threshold
        if (pullDistance >= pullThreshold) {
            triggerRefresh(pullToRefreshEl, pullToRefreshText);
        } else {
            // Reset indicator
            resetPullToRefresh(pullToRefreshEl);
        }

        isPulling = false;
        startY = 0;
        currentY = 0;
    }, { passive: true });
}

function triggerRefresh(pullToRefreshEl, pullToRefreshText) {
    // Show refreshing state
    pullToRefreshEl.style.top = '0';
    pullToRefreshEl.classList.remove('pulling', 'release');
    pullToRefreshEl.classList.add('refreshing');
    pullToRefreshText.textContent = 'Refreshing...';

    // Refresh data
    fetchData()
        .then(() => {
            filterAndSortData();
            updateStatistics();
            initCharts();

            // Show success notification
            showNotification('Schedule updated successfully!', 'success');

            // Reset after short delay
            setTimeout(() => {
                resetPullToRefresh(pullToRefreshEl);
            }, 500);
        })
        .catch((error) => {
            log('Refresh failed:', error);
            showNotification('Failed to refresh. Please try again.', 'error');
            resetPullToRefresh(pullToRefreshEl);
        });
}

function resetPullToRefresh(pullToRefreshEl) {
    pullToRefreshEl.style.top = '-80px';
    pullToRefreshEl.classList.remove('pulling', 'release', 'refreshing');

    const pullToRefreshText = pullToRefreshEl.querySelector('.pull-to-refresh-text');
    if (pullToRefreshText) {
        pullToRefreshText.textContent = 'Pull to refresh';
    }
}

// ============================================
// Bottom Navigation (App-Style)
// ============================================

function initBottomNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const sections = document.querySelectorAll('[data-nav-section]');

    // Navigation click handler
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.getAttribute('data-section');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Scroll to target section
            const section = document.querySelector(`[data-nav-section="${targetSection}"]`);
            if (section) {
                const headerHeight = document.querySelector('header')?.offsetHeight || 0;
                const navHeight = document.querySelector('.bottom-nav')?.offsetHeight || 0;
                const yOffset = -(headerHeight + 20); // 20px extra padding
                const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;

                window.scrollTo({
                    top: y,
                    behavior: 'smooth'
                });

                // Save active section
                safeLocalStorageSet('activeNavSection', targetSection);
            }
        });
    });

    // Highlight active section on scroll
    let isScrolling;
    window.addEventListener('scroll', () => {
        // Clear timeout throughout the scroll
        clearTimeout(isScrolling);

        // Set a timeout to run after scrolling ends
        isScrolling = setTimeout(() => {
            updateActiveNavOnScroll(navItems, sections);
        }, 100);
    }, { passive: true });

    // Restore active section from localStorage
    const activeSection = safeLocalStorageGet('activeNavSection') || 'home';
    const activeNavItem = document.querySelector(`.bottom-nav .nav-item[data-section="${activeSection}"]`);
    if (activeNavItem) {
        navItems.forEach(nav => nav.classList.remove('active'));
        activeNavItem.classList.add('active');
    }
}

function updateActiveNavOnScroll(navItems, sections) {
    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    const navHeight = document.querySelector('.bottom-nav')?.offsetHeight || 0;
    const scrollPosition = window.scrollY + headerHeight + 100;

    // Find which section is currently in view
    let currentSection = 'home';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            currentSection = section.getAttribute('data-nav-section');
        }
    });

    // Update active nav item based on current section
    const activeNavItem = document.querySelector(`.bottom-nav .nav-item[data-section="${currentSection}"]`);
    if (activeNavItem && !activeNavItem.classList.contains('active')) {
        navItems.forEach(nav => nav.classList.remove('active'));
        activeNavItem.classList.add('active');
        safeLocalStorageSet('activeNavSection', currentSection);
    }
}
