const map = new maplibregl.Map({
    container: 'map', // container id
    style: 'https://demotiles.maplibre.org/style.json', // style URL
    center: [-60, 30],
        zoom: 2
});

const geolocateControl = new maplibregl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
});

map.addControl(geolocateControl);


const request = indexedDB.open('LocationDB', 1);
let i = 0;
request.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('locations')) {
        db.createObjectStore('locations', { keyPath: 'timestamp' });
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
    const data = { latitude, longitude, timestamp: new Date().getTime() };
    store.add(data);
}

function loadLocations() {
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.getAll();

    request.onsuccess = event => {
        const locations = event.target.result;
        const coordinates = locations.map(loc => [loc.longitude+1, loc.latitude+1]);
        if (coordinates.length > 0) {
            drawRoute(coordinates);
        }
    };

    request.onerror = event => {
        console.error('IndexedDB error:', event.target.errorCode);
    };
}

function updateMap(latitude, longitude) {
    saveLocation(latitude, longitude);
    loadLocations();
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
    }
}


setInterval(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            let { latitude, longitude } = position.coords;
            latitude+=i
            i++;
            
            updateMap(latitude, longitude);
            console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);

            new maplibregl.Marker()
                .setLngLat([longitude, latitude])
                .addTo(map);
        });
    }
}, 5000);
