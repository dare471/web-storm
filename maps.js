// Создаем карту и устанавливаем начальный вид
const map = L.map('map').setView([48.0196, 66.9237], 5);

// Добавляем слой OSM
L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19,
        attribution: '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }
).addTo(map);

// Массив с городами Казахстана
const cities  = [
    ["Актау", 43.6519, 51.1617],
    ["Актобе", 50.2839, 57.167],
    ["Атырау", 47.1164, 51.9244],
    ["Караганда", 49.806, 73.0857],
    ["Кокшетау", 53.2948, 69.4048],
    ["Костанай", 53.2144, 63.6246],
    ["Кызылорда", 44.8488, 65.4823],
    ["Павлодар", 52.2872, 76.9674],
    ["Петропавловск", 54.8753, 69.1638],
    ["Семей", 50.4233, 80.2593],
    ["Талдыкорган", 45.0156, 78.3734],
    ["Тараз", 42.8992, 71.3776],
    ["Туркестан", 43.2973, 68.2481],
    ["Уральск", 51.2278, 51.3865],
    ["Усть-Каменогорск", 49.9483, 82.6286],
    ["Алматы", 43.238949, 76.889709],
    ["Астана (Нур-Султан)", 51.169392, 71.449074],
    ["Шымкент", 42.3417, 69.5901],
    // ["Темиртау", 50.0536, 72.9646], // Карагандинская область
    // ["Экибастуз", 51.7298, 75.3234], // Павлодарская область
   // ["Рудный", 52.9714, 63.1203]    // Костанайская область
];

// Функция добавления маркеров городов с постоянным отображением названия
const addMarkerCity = cities => {
    cities.forEach(city => {
        L.marker([city[1], city[2]], {
            icon: L.divIcon({
                className: 'city-label',
                html: `<div style="
                    background-color: white;
                    padding: 5px 5px;
                    opacity: 0.9;
                    text-align: center;
                    color: #333;
                    font-weight: bold;
                    font-size: 11px;
                    border-radius: 15px;
                    border: 1px solid #888;
                    box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.3);
                    ">
                    ${city[0]}
                    </div>`,
                iconSize: [100, 24],
                iconAnchor: [10, 12]
            })
        }).addTo(map);
    });
};

// Добавляем маркеры городов
addMarkerCity(cities);

// Определяем цвета
const colors = ["#008024", "#9400bd", "#e3e01a", "#2a93fc", "#FD8D3C", "#FEB24C", "#FED976", "#FFEDA0", "#FFFFCC"];
const getColor = index => colors[index % colors.length];
const getPolygonCenter = latlngs => L.latLngBounds(latlngs).getCenter();

let polygonsLayer;
let currentZoomLevel = map.getZoom();
let sectorMarkers = {};
const polygonsByColor = new Map();

// Загрузка и добавление слоя GeoJSON
fetch('http://10.200.100.17/api/multipolygon')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        polygonsLayer = L.geoJson(data, {
            style: feature => {
                const color = getColorFromFeature(feature, currentZoomLevel);
                return {
                    color: '#000000',
                    fillColor: color.fillColor,
                    fillOpacity: 0.5, // Уменьшите значение
                    weight: 2
                };
            },
            onEachFeature: (feature, layer) => {
                bindTooltipToLayer(feature, layer);
                const color = getColorFromFeature(feature, currentZoomLevel).fillColor;
                if (!polygonsByColor.has(color)) {
                    polygonsByColor.set(color, []);
                }
                polygonsByColor.get(color).push(layer);
            }
        }).addTo(map);

        updateZoomLevelDisplay(currentZoomLevel);
        addMarkersByZoomLevel(currentZoomLevel);
        updateColorList(data.features, currentZoomLevel);
    })
    .catch(error => console.error('Error fetching the GeoJSON data:', error));

// Вспомогательные функции

const getColorFromFeature = (feature, zoom) => {
    if (zoom >= 7) {
        return { fillColor: feature.properties.color_direction || '#000000', fillOpacity: 0.7 };
    }
    return { fillColor: feature.properties.color_direction || '#000000', fillOpacity: 0.7 };
};

const getLatLngsFromLayer = layer => {
    if (layer.feature.geometry.type === 'Polygon') {
        return layer.getLatLngs()[0];
    } else if (layer.feature.geometry.type === 'MultiPolygon') {
        return layer.feature.geometry.coordinates[0][0].map(coord => [coord[1], coord[0]]);
    }
};
function formatToCurrency(value) {
    // Проверяем, является ли значение числом
    if (isNaN(value)) return value;

    // Форматируем число с пробелами для тысяч и добавляем знак валюты
    return `${Number(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}
const bindTooltipToLayer = (feature, layer) => {
    const tooltipContent = `
        <strong>ID:</strong> ${feature.properties.gid}<br />
        <strong>Область:</strong> ${feature.properties.sr_region}<br />
        <strong>Дирекция:</strong> ${feature.properties.direction}<br />
        <strong>Сектор:</strong> ${feature.properties.sector}<br />
        <strong>Район:</strong> ${feature.properties.name_3}<br />
        <strong>Количество клиентов:</strong> ${feature.properties.sr_count}<br />
        <strong>Потенциал:</strong> ${formatToCurrency(feature.properties.sr_potential_c)}<br />
        <strong>Ответственный:</strong> ${feature.properties.sr_sherifs}<br />
        <strong>На текущий момент Отв.:</strong> ${feature.properties.staff_now}<br />
    `;
    layer.bindTooltip(tooltipContent, {
        permanent: false,      // Всплывающее окно только при наведении
        direction: "top",      // Положение над полигоном
        offset: L.point(0, -10), // Смещение над полигоном
        className: "custom-tooltip" // Дополнительный класс для кастомизации
    });
};

const updateZoomLevelDisplay = zoom => {
    const zoomLevelDiv = document.getElementById('zoom-level');
    zoomLevelDiv.textContent = `Увеличения масштаба: ${zoom}`;
};

const addMarkersByProperty = (property, transformText, checkSectorDirection = false) => {
    polygonsLayer.eachLayer(layer => {
        const feature = layer.feature;
        const text = feature.properties[property];

        if (text && (!checkSectorDirection || (feature.properties.sector && feature.properties.direction))) {
            const center = getPolygonCenter(getLatLngsFromLayer(layer));
            layer._marker = L.marker(center, {
                icon: L.divIcon({
                    className: 'polygon-label',
                    html: transformText(text),
                    iconSize: [100, 40],
                    iconAnchor: [50, 20]
                })
            }).addTo(map);
        }
    });
};

const addMarkersByZoomLevel = zoom => {
    if (polygonsLayer) {
        polygonsLayer.eachLayer(layer => {
            if (layer._marker) {
                map.removeLayer(layer._marker);
                layer._marker = null;
            }
        });
    }

    if (zoom === 5) {
      //  addMarkersByProperty('', sector => sector);
    } else if (zoom === 6) {
        //addMarkersByProperty('sector', sector => sector);
    } else if (zoom >= 7) {
        addMarkersByProperty('name_3', text => text, true);
    }
};

const updateColorList = (features, zoom) => {
    const colorListDiv = document.getElementById('color-list');
    colorListDiv.innerHTML = '<div class="color-title">Доступные цвета: </div>';

    const activeColors = features.map(feature => {
        if (zoom >= 7) {
            return { color: feature.properties.color_direction, name: feature.properties.sector };
        }
        return { color: feature.properties.color_direction, name: feature.properties.direction };
    }).filter(item => item.color && item.color !== 'null' && item.color.trim() !== '');

    const uniqueColors = [...new Set(activeColors.map(item => `${item.color}-${item.name}`))];

    uniqueColors.forEach(item => {
        const [color, name] = item.split('-');
        const listItem = document.createElement('div');
        listItem.className = 'color-item';
        listItem.style.color = color;
        listItem.textContent = `${name}: ${color}`;
        listItem.dataset.color = color;

        listItem.addEventListener('click', () => highlightPolygonsByColor(color));
        colorListDiv.appendChild(listItem);
    });
};

// Функция для выделения группы полигонов по цвету
const highlightPolygonsByColor = color => {
    polygonsLayer.setStyle(feature => {
        const layerColor = getColorFromFeature(feature, currentZoomLevel).fillColor;
        return {
            color: '#000000',
            fillColor: layerColor,
            fillOpacity: 0.7,
            weight: 2
        };
    });

    if (polygonsByColor.has(color)) {
        const layers = polygonsByColor.get(color);
        layers.forEach(layer => {
            layer.setStyle({
                color: '#ff7800',
                weight: 4
            });
        });

        if (layers.length > 0) {
            map.fitBounds(layers[0].getBounds());
        }
    }
};

// Обработчик для изменения уровня зума
map.on('zoomend', () => {
    const currentZoom = map.getZoom();
    updateZoomLevelDisplay(currentZoom);
    currentZoomLevel = currentZoom;
    polygonsLayer.setStyle(feature => {
        const color = getColorFromFeature(feature, currentZoom);
        return {
            color: '#000000',
            fillColor: color.fillColor,
            fillOpacity: color.fillOpacity,
            weight: 2
        };
    });
    updateColorList(polygonsLayer.toGeoJSON().features, currentZoom);
});

