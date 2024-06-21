const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [-80, 30],
    zoom: 4
});

let i = 0;
let j = 0;
const request = indexedDB.open('locations', 1);

request.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('locations')) {
        const objectStore = db.createObjectStore('locations', { keyPath: 'timestamp' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('lname', 'lname', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
        objectStore.createIndex('ratings', 'ratings', { unique: false });
    }
};

let db;
request.onsuccess = event => {
    db = event.target.result;
    loadLocations();
};

request.onerror = event => {
    console.error('IndexedDB error:', event.target.errorCode);
};

function saveLocation(latitude, longitude) {
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    const data = {
        OBJECTID: getNextObjectId(),
        latitude,
        longitude,
        timestamp: new Date().getTime(),
        note: '',
        lname: '',
        type: '',
        ratings: 0
    };
    store.add(data);
}

async function getToken(data, latitude, longitude) {
    const body = {
        "username": "GISTest_Editor",
        "password": "GISTest_Editor2024#",
        "client": "referer",
        "referer": "localhost:3000",
        "f": "json"
    };

    var formBody = [];
    for (var property in body) {
        var encodedKey = encodeURIComponent(property);
        var encodedValue = encodeURIComponent(body[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    const tresp = await fetch("https://gistest.twdb.texas.gov/portal/sharing/rest/generateToken", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: formBody
    });

    const tjson = await tresp.json();

    addPoints(tjson.token, data, parseFloat(latitude), parseFloat(longitude));
}

async function addPoints(token, data, latitude, longitude) {
    const url = `https://gistest.twdb.texas.gov/server/rest/services/TxGIO_GIT/Dipak_Test_Collection_Rating/FeatureServer/0/addFeatures?f=pjson&token=${token}`;

    // const body = {
    //     Features: `[{"attributes" : {"Name": "${data.lname}","Type":"${data.type}","Notes": "${data.note}","Rating":"${data.ratings}"},"geometry": {"x": ${latitude}, "y": ${longitude} }}]`
    // };

    const body = {
        Features: JSON.stringify([
            {
                attributes: {
                    Name: data.lname,
                    Type: data.type,
                    Notes: data.note,
                    Rating: data.ratings
                },
                geometry: {
                    x: longitude,  
                    y: latitude    
                }
            }
        ])
    };

    var formBody = [];
    for (var property in body) {
        var encodedKey = encodeURIComponent(property);
        var encodedValue = encodeURIComponent(body[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    const editr = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: formBody
    });

}


let nextObjectId = 1;
function getNextObjectId() {
    return nextObjectId++;
}

function loadLocations() {
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.getAll();
    console.log(transaction);
    console.log(store);
    console.log(request);

    request.onsuccess = event => {
        const locations = event.target.result;
        const coordinates = locations.map(loc => [loc.longitude, loc.latitude]);
        if (coordinates.length > 0) {
            drawRoute(coordinates);
            updateLocationList(locations);
        }
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.errorCode);
    };
}



function saveNoteToLocation(timestamp, lname, type, ratings, note, latitude, longitude) {
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    const request = store.get(timestamp);

    request.onsuccess = event => {
        let data = event.target.result;
        data.lname = lname;
        data.type = type;
        data.ratings = ratings;
        data.note = note;
        store.put(data);
        getToken(data, latitude, longitude);
        loadLocations();
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.errorCode);
    };
}



function updateLocationList(locations) {
    const locationList = document.getElementById('locationList');
    locationList.innerHTML = '';

    locations.forEach(location => {
        const listItem = document.createElement('li');
        listItem.className = 'location-item';
        listItem.innerHTML = `
            <input type="radio" name="location" class="location-radio" data-lat="${location.latitude}" data-lng="${location.longitude}">

            <label for="latitude">Latitude:</label>
            <input type="text" class="latitude-input" id="latitude" name="latitude" value="${location.latitude}" readonly><br>

            <label for="longitude">Longitude:</label>
            <input type="text" class="longitude-input" id="longitude" name="longitude" value="${location.longitude}" readonly><br>

            <label for="objectid">OBJECTID:</label>
            <input type="text" class="objectid-input" id="objectid" name="objectid" value="${location.OBJECTID}" readonly><br>

            <input class="name-input" type="text" placeholder="Name" value="${location.lname || ''}" />
            <input class="type-input" type="text" placeholder="Type" value="${location.type || ''}" />

            <select class="rating-select">
                <option value="0" ${location.ratings === '0' ? 'selected' : 'selected'}>0</option>
                <option value="1" ${location.ratings === '1' ? 'selected' : ''}>1</option>
                <option value="2" ${location.ratings === '2' ? 'selected' : ''}>2</option>
                <option value="3" ${location.ratings === '3' ? 'selected' : ''}>3</option>
                <option value="4" ${location.ratings === '4' ? 'selected' : ''}>4</option>
                <option value="5" ${location.ratings === '5' ? 'selected' : ''}>5</option>
            </select>
            <textarea class="note-input" placeholder="Add a note...">${location.note || ''}</textarea>
            <button class="save-button" data-timestamp="${location.timestamp}">Save</button>
        `;
        locationList.appendChild(listItem);
    });

    let markers = [];
    document.querySelectorAll('.location-radio').forEach(radio => {
        radio.addEventListener('click', event => {
            const latitude = parseFloat(event.target.getAttribute('data-lat'));
            const longitude = parseFloat(event.target.getAttribute('data-lng'));
            markers.forEach(marker => marker.remove());
            markers = [];

            map.flyTo({ center: [longitude, latitude], zoom: 6 });
            const newMarker = new maplibregl.Marker({ color: 'red' })
                .setLngLat([longitude, latitude])
                .addTo(map);
            markers.push(newMarker);
        });
    });

    document.querySelectorAll('.save-button').forEach(button => {
        button.addEventListener('click', event => {

            markers.forEach(marker => marker.remove());
            markers = [];

            const li = event.target.parentElement;
            const timestamp = parseInt(event.target.getAttribute('data-timestamp'), 10);
            const lname = li.querySelector('.name-input').value;
            const type = li.querySelector('.type-input').value;
            const ratings = li.querySelector('.rating-select').value;
            const note = li.querySelector('.note-input').value;
            const latitude = li.querySelector('.latitude-input').value;
            const longitude = li.querySelector('.longitude-input').value;
            saveNoteToLocation(timestamp, lname, type, ratings, note, latitude, longitude);
        });
    });
}

function showPopup(message, latitude, longitude) {
    const popup = new maplibregl.Popup({ closeOnClick: false })
        .setLngLat([longitude, latitude])
        .setHTML(`<h3>Alert</h3><p>${message}</p>`)
        .addTo(map);
}



const polygonCoordinates = [
    [-96.0, 25.0],
    [-92.5, 28.0],
    [-95.5, 30.0],
    [-97.0, 32.0],
    [-100.0, 31.0],
    [-100.0, 29.0],
    [-96.0, 25.0]
];

const geofencePolygon = turf.polygon([polygonCoordinates]);

function addGeofencePolygon(polygon) {
    if (map.getSource('geofence')) {
        map.getSource('geofence').setData(polygon);
    } else {
        map.addSource('geofence', {
            type: 'geojson',
            data: polygon
        });

        map.addLayer({
            id: 'geofence-border',
            type: 'line',
            source: 'geofence',
            paint: {
                'line-color': '#FF0000',
                'line-width': 2
            }
        });
    }
}


function isPointInGeofence(latitude, longitude) {
    const point = turf.point([longitude, latitude]);
    return turf.booleanPointInPolygon(point, geofencePolygon);
}


async function addNeighborhoodPoints() {
    try {
        const response = await fetch('https://data.texas.gov/resource/m3yf-ffwm.geojson');
        const geojson = await response.json();


        map.addSource('source', {
            'type': 'geojson',
            'data': geojson
        });

        map.addLayer({
            'id': 'polygons',
            'type': 'fill',
            'source': 'source',
            'paint': {
                'fill-color': '#888888',
                'fill-outline-color': 'red',
                'fill-opacity': 0.4
            },

            'filter': ['==', '$type', 'Polygon']
        });

    } catch (error) {
        console.error('Error fetching neighborhood data:', error);
    }
}


function updateMap(latitude, longitude) {
    let flag = isPointInGeofence(latitude, longitude);
    if (flag) {
        saveLocation(latitude, longitude);
        loadLocations();
        map.setCenter([longitude, latitude]);
    }
    else {
        stopTracking();
        showPopup('You have moved out of the allowed area!', latitude, longitude);
    }
}

function drawRoute(coordinates) {
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
    } else {
        map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            }
        });

        map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#888',
                'line-width': 6
            }
        });

        map.addLayer({
            id: 'route-poimts',
            type: 'circle',
            source: 'route',
            paint: {
                'circle-radius': 6,
                'circle-color': '#B42222'
            }
        });
    }
}

document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);
document.getElementById('showChart').addEventListener('click', () => {
    showRatingsChart();
});
document.getElementById('closeChart').addEventListener('click', () => {
    closeRatingsChart();
});

let tracking = false;
let first = true;
let intervalId;

function startTracking() {
    if (!tracking) {
        tracking = true;
        intervalId = setInterval(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    let { latitude, longitude } = position.coords;
                    latitude += i
                    longitude += j
                    i += (Math.random() * 2);
                    i -= 1;
                    j += (Math.random() * 3);
                    j -= 1;
                    console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);

                    updateMap(latitude, longitude);

                    if (first) {
                        new maplibregl.Marker()
                            .setLngLat([longitude, latitude])
                            .addTo(map);
                        first = false;
                    }
                });
            }
        }, 5000);

    }
}


function stopTracking() {
    if (tracking) {
        tracking = false;
        clearInterval(intervalId);
    }
}


let myChart;
function showRatingsChart() {
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.getAll();

    request.onsuccess = event => {
        const locations = event.target.result;
        const ratingsCount = locations.reduce((acc, loc) => {
            acc[loc.ratings] = (acc[loc.ratings] || 0) + 1;
            return acc;
        }, {});

        if (myChart) {
            myChart.destroy();
        }
        const ctx = document.getElementById('ratingsChart').getContext('2d');
        myChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(ratingsCount),
                datasets: [{
                    data: Object.values(ratingsCount),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        });

        document.getElementById('rChart').style.display = 'block';
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.errorCode);
    };
}

function closeRatingsChart() {
    document.getElementById('rChart').style.display = 'none';
}

map.on('load', () => {
    addNeighborhoodPoints();
    addGeofencePolygon(geofencePolygon);
});

document.getElementById('searchBar').addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const locationItems = document.querySelectorAll('.location-item');

    locationItems.forEach(item => {
        const lname = item.querySelector('.name-input').value.toLowerCase();
        const type = item.querySelector('.type-input').value.toLowerCase();
        const ratings = item.querySelector('.rating-select').value.toLowerCase();
        const note = item.querySelector('.note-input').value.toLowerCase();

        if (lname.includes(query) || type.includes(query) || ratings.includes(query) || note.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
});



