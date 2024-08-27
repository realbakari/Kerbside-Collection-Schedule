let allData = [];
let currentPage = 1;
const itemsPerPage = 16; // 8 cards per column, 2 columns

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

console.log('brisbaneCitySuburbs length:', brisbaneCitySuburbs.length);
console.log('First few suburbs:', brisbaneCitySuburbs.slice(0, 5));

function fetchData() {
    console.log('Fetching data...');
    return fetch('dataset/kerbside-large-item-collection-schedule.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load data');
            return response.json();
        })
        .then(data => {
            allData = data;
            console.log('Data fetched, length:', allData.length);
            if (!allData || allData.length === 0) {
                throw new Error('No data received');
            }
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dataContainer').style.display = 'grid';
            populateWeekFilter();
            renderCards(allData);
            return data;
        })
        .catch(error => {
            console.error('Error in fetchData:', error);
            document.getElementById('loading').style.display = 'none';
            const errorDiv = document.getElementById('error');
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Error loading data: ' + error.message;
            throw error;
        });
}

function populateWeekFilter() {
    const weekFilter = document.getElementById('weekFilter');
    const weeks = [...new Set(allData.map(item => item.week))].sort((a, b) => a - b);
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Week ${week}`;
        weekFilter.appendChild(option);
    });
}

function renderCards(data) {
    console.log('renderCards called with', data.length, 'items');
    const dataContainer = document.getElementById('dataContainer');
    if (!dataContainer) {
        console.error('Data container not found');
        return;
    }
    dataContainer.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const pageData = data.slice(startIndex, endIndex);
    console.log('Rendering page data:', pageData);
    const currentDate = new Date();

    pageData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        if (item.isPlaceholder) {
            card.innerHTML = `
                <h3><i class="fas fa-map-marker-alt"></i> ${item.suburb}</h3>
                <p>No collection data available for this suburb.</p>
            `;
        } else {
            const collectionDate = new Date(item.date_of_collection);
            const itemsOutDate = new Date(item.items_out_on_footpath);
            const isCollectionCompleted = collectionDate < currentDate;
            const isItemsOutCompleted = itemsOutDate < currentDate;

            card.innerHTML = `
                <h3><i class="fas fa-map-marker-alt"></i> ${item.suburb}</h3>
                <p><i class="fas fa-calendar-week"></i> Week: ${item.week}</p>
                <p class="collection-date ${isCollectionCompleted ? 'completed' : ''}">
                    <i class="fas fa-truck"></i> 
                    <strong>Collection Date:</strong> ${collectionDate.toLocaleDateString()}
                    ${isCollectionCompleted ? '<i class="fas fa-check-circle completed-icon"></i>' : ''}
                </p>
                <p class="items-out-date ${isItemsOutCompleted ? 'completed' : ''}">
                    <i class="fas fa-box"></i> 
                    <strong>Items Out Date:</strong> ${itemsOutDate.toLocaleDateString()}
                    ${isItemsOutCompleted ? '<i class="fas fa-check-circle completed-icon"></i>' : ''}
                </p>
                <p class="countdown" data-collection-date="${item.date_of_collection}"></p>
            `;
        }
        
        dataContainer.appendChild(card);
    });

    console.log(`Rendered ${pageData.length} cards`);
    updateCountdowns();
    renderPagination(data.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';

    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '<';
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCards(filterData());
            }
        });
        paginationContainer.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.className = 'page-info';
        paginationContainer.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = '>';
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderCards(filterData());
            }
        });
        paginationContainer.appendChild(nextButton);

        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
}

function filterData() {
    console.log('filterData called');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    console.log('Search term:', searchTerm);
    const weekFilter = document.getElementById('weekFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const completionFilter = document.getElementById('completionFilter').value;
    const currentDate = new Date();

    // First, filter the allData
    const filteredData = allData.filter(item => {
        const matchesSearch = item.suburb.toLowerCase().includes(searchTerm) ||
            (item.suburb_list && item.suburb_list.toLowerCase().includes(searchTerm));
        const matchesWeek = weekFilter === '' || item.week.toString() === weekFilter;
        const matchesDate = dateFilter === '' || new Date(item.date_of_collection).toISOString().split('T')[0] === dateFilter;
        
        const collectionDate = new Date(item.date_of_collection);
        const isCompleted = collectionDate < currentDate;
        const matchesCompletion = completionFilter === '' || 
            (completionFilter === 'completed' && isCompleted) ||
            (completionFilter === 'not-completed' && !isCompleted);

        return matchesSearch && matchesWeek && matchesDate && matchesCompletion;
    });

    // Then, find matching suburbs from brisbaneCitySuburbs
    const matchingSuburbs = brisbaneCitySuburbs.filter(suburb => 
        suburb.toLowerCase().includes(searchTerm)
    );

    console.log('Matching suburbs:', matchingSuburbs);

    // Create placeholder data for matching suburbs not in allData
    const placeholderData = matchingSuburbs
        .filter(suburb => !filteredData.some(item => item.suburb.toLowerCase() === suburb.toLowerCase()))
        .map(suburb => ({
            suburb: suburb,
            week: 'N/A',
            date_of_collection: 'N/A',
            items_out_on_footpath: 'N/A',
            isPlaceholder: true
        }));

    // Combine filtered data and placeholder data
    const combinedData = [...filteredData, ...placeholderData];

    console.log('Combined data length:', combinedData.length);
    return combinedData;
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    filterAndSortData();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('weekFilter').value = '';
    document.getElementById('dateFilter').value = '';
    document.getElementById('completionFilter').value = '';
    currentPage = 1; // Reset to first page on clear
    renderCards(allData);
}

function sortData(data) {
    const sortOption = document.getElementById('sortOption').value;
    return data.sort((a, b) => {
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
    console.log('filterAndSortData called');
    let filteredData = filterData();
    filteredData = sortData(filteredData);
    renderCards(filteredData);
    updateCountdowns(); // Add this line
}

function populateSuburbList() {
    console.log('populateSuburbList called');
    let suburbList = document.getElementById('suburbList');
    if (!suburbList) {
        console.log('Creating suburbList element');
        suburbList = document.createElement('datalist');
        suburbList.id = 'suburbList';
        document.body.appendChild(suburbList);
    }
    
    // Clear existing options
    suburbList.innerHTML = '';
    
    brisbaneCitySuburbs.forEach(suburb => {
        const option = document.createElement('option');
        option.value = suburb;
        suburbList.appendChild(option);
    });
    console.log('Suburb list populated with', brisbaneCitySuburbs.length, 'suburbs');
}

function savePreferences() {
    const preferences = {
        searchTerm: document.getElementById('searchInput').value,
        weekFilter: document.getElementById('weekFilter').value,
        dateFilter: document.getElementById('dateFilter').value,
        completionFilter: document.getElementById('completionFilter').value,
        sortOption: document.getElementById('sortOption').value
    };
    localStorage.setItem('kerbsidePreferences', JSON.stringify(preferences));
}

function loadPreferences() {
    const preferences = JSON.parse(localStorage.getItem('kerbsidePreferences'));
    if (preferences) {
        document.getElementById('searchInput').value = preferences.searchTerm || '';
        document.getElementById('weekFilter').value = preferences.weekFilter || '';
        document.getElementById('dateFilter').value = preferences.dateFilter || '';
        document.getElementById('completionFilter').value = preferences.completionFilter || '';
        document.getElementById('sortOption').value = preferences.sortOption || 'suburb';
        filterAndSortData();
    }
}

function updateCountdowns() {
    console.log('Updating countdowns');
    const countdownElements = document.querySelectorAll('.countdown');
    console.log(`Found ${countdownElements.length} countdown elements`);
    const now = new Date();

    countdownElements.forEach((element, index) => {
        if (!element.dataset.collectionDate) {
            console.warn(`Countdown element ${index} missing collection date:`, element);
            return;
        }

        const collectionDate = new Date(element.dataset.collectionDate);
        const timeLeft = collectionDate - now;

        console.log(`Element ${index}: Collection date: ${collectionDate}, Time left: ${timeLeft}`);

        if (timeLeft > 0) {
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            const countdownText = `Next collection in: ${days} days, ${hours} hours, ${minutes} minutes`;
            console.log(`Setting countdown text for element ${index}: ${countdownText}`);
            element.textContent = countdownText;
        } else {
            console.log(`Collection has already occurred for element ${index}`);
            element.textContent = 'Collection has already occurred';
        }
    });
}

// Call updateCountdowns every minute
setInterval(updateCountdowns, 60000);

function waitForJsPDF(callback) {
    if (window.jspdf) {
        callback();
    } else {
        setTimeout(() => waitForJsPDF(callback), 100);
    }
}

function exportToPDF() {
    waitForJsPDF(() => {
        const { jsPDF } = window.jspdf;
        const filteredData = filterData();
        const doc = new jsPDF();

        // Set font styles
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(44, 62, 80); // Dark blue color

        // Add header
        doc.text("Kerbside Collection Schedule", 105, 15, null, null, "center");
        
        // Add logo (replace with your own logo URL)
        doc.addImage("https://s3-ap-southeast-2.amazonaws.com/aws-ec2-ap-southeast-2-opendatasoft-staticfileset/prod-brisbane-queensland/logo?tstamp=17101930999905946", "PNG", 10, 5, 20, 20);

        // Add current date
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 195, 10, null, null, "right");

        // Add a line
        doc.setLineWidth(0.5);
        doc.line(10, 25, 200, 25);

        // Set content font
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(0);

        let yPos = 35;
        filteredData.forEach((item, index) => {
            // Add suburb header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(41, 128, 185); // Light blue color
            doc.text(`${item.suburb} - Week ${item.week}`, 10, yPos);
            yPos += 7;

            // Add collection details
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text(`Collection Date: ${new Date(item.date_of_collection).toLocaleDateString()}`, 15, yPos);
            yPos += 6;
            doc.text(`Items Out Date: ${new Date(item.items_out_on_footpath).toLocaleDateString()}`, 15, yPos);
            yPos += 10;

            // Add a light gray line between entries
            doc.setDrawColor(200);
            doc.line(10, yPos - 5, 200, yPos - 5);
            yPos += 5;

            if (yPos > 280 || index === filteredData.length - 1) {
                doc.addPage();
                yPos = 20;
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, null, null, "center");
        }

        doc.save("kerbside_collection_schedule.pdf");
    });
}

function exportToCSV() {
    const filteredData = filterData();
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add headers
    csvContent += "Suburb,Week,Collection Date,Items Out Date\n";
    
    // Add data rows
    filteredData.forEach(item => {
        const collectionDate = new Date(item.date_of_collection).toLocaleDateString();
        const itemsOutDate = new Date(item.items_out_on_footpath).toLocaleDateString();
        const row = `${item.suburb},${item.week},${collectionDate},${itemsOutDate}`;
        csvContent += row + "\n";
    });

    // Create a download link and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kerbside_collection_schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleFeedback(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

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
                    alert("Oops! There was a problem submitting your form");
                }
            })
        }
    }).catch(error => {
        alert("Oops! There was a problem submitting your form");
    });
}

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
    const suburbData = allData.filter(item => item.suburb === selectedSuburb);
    
    const stats = suburbData.reduce((acc, item) => {
        const year = new Date(item.date_of_collection).getFullYear();
        if (!acc[year]) acc[year] = 0;
        acc[year]++;
        return acc;
    }, {});
    
    let statsHtml = '<h3>Collection Statistics for ' + selectedSuburb + '</h3>';
    for (const [year, count] of Object.entries(stats)) {
        statsHtml += `<p>${year}: ${count} collections</p>`;
    }
    
    document.getElementById('historicalStats').innerHTML = statsHtml;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded. PDF export will not work.');
    }
    
    populateSuburbList();
    
    // Add event listeners here
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
            console.error(`Element with id "${id}" not found`);
        }
    }

    // Add event listeners only if elements exist
    if (elements.searchInput) {
        console.log('Search input found, adding event listener');
        elements.searchInput.addEventListener('input', filterAndSortData);
    } else {
        console.error('Search input not found');
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

    fetchData()
        .then(() => {
            loadPreferences();
            filterAndSortData(); // Apply initial filtering and sorting
            setInterval(updateCountdowns, 60000); // Update countdowns every minute
            populateHistoricalSuburbs();
        })
        .catch(error => console.error('Failed to initialize:', error));
});
