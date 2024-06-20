const map = new maplibregl.Map({
    container: 'map', // container id
    style: 'https://demotiles.maplibre.org/style.json', // style URL
    center: [-80, 30],
    zoom: 4
});

let i = 0;
let j = 0;
const request = indexedDB.open('LocationDB', 1);

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
        ratings: ''
    };
    store.add(data);
}

let nextObjectId = 1; // Start from 1, increase as new locations are added
function getNextObjectId() {
    return nextObjectId++;
}

function loadLocations() {
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.getAll();

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



function saveNoteToLocation(timestamp, lname, type, ratings, note) {
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
        loadLocations(); // Reload locations to update the list display
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
            <p>Latitude: ${location.latitude}, Longitude: ${location.longitude}, OBJECTID: ${location.OBJECTID}</p>
            <input class="name-input" type="text" placeholder="Name" value="${location.lname || ''}" />
            <input class="type-input" type="text" placeholder="Type" value="${location.type || ''}" />
            <select class="rating-select">
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

    document.querySelectorAll('.save-button').forEach(button => {
        button.addEventListener('click', event => {
            const li = event.target.parentElement;
            const timestamp = parseInt(event.target.getAttribute('data-timestamp'), 10);
            const lname = li.querySelector('.name-input').value;
            const type = li.querySelector('.type-input').value;
            const ratings = li.querySelector('.rating-select').value;
            const note = li.querySelector('.note-input').value;
            saveNoteToLocation(timestamp, lname, type, ratings, note);
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


document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);



map.on('load', () => {
    addGeofencePolygon(geofencePolygon);
});

