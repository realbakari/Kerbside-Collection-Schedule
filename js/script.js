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

        return matchesSearch && matchesWeek && matchesDate && matchesCompletion;
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
    currentPage = 1;
    renderCards(allData);
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

    fetchData()
        .then(() => {
            loadPreferences();
            filterAndSortData();
            setInterval(updateCountdowns, CONFIG.PAGINATION.UPDATE_INTERVAL);
            populateHistoricalSuburbs();

            // Initialize data visualizations
            updateStatistics();
            initCharts();
        })
        .catch(error => log('Failed to initialize:', error));
});
