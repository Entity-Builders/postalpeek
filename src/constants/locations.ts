export interface Location {
  name: string;
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  zoom: number;
}

export const WALKER_LOCATIONS: Location[] = [
  { name: 'Tokyo, Japan', lat: 35.6595, lng: 139.7005, heading: 45, pitch: 10, zoom: 0 },
  { name: 'Kyoto, Japan', lat: 35.0061, lng: 135.7736, heading: 270, pitch: 5, zoom: 0 },
  { name: 'Paris, France', lat: 48.8606, lng: 2.3376, heading: 180, pitch: 15, zoom: 0 },
  { name: 'Venice, Italy', lat: 45.4382, lng: 12.3211, heading: 90, pitch: 0, zoom: 0 },
  { name: 'Rome, Italy', lat: 41.8986, lng: 12.4769, heading: 320, pitch: 10, zoom: 0 },
  { name: 'London, UK', lat: 51.5113, lng: -0.119, heading: 120, pitch: 5, zoom: 0 },
  { name: 'Edinburgh, Scotland', lat: 55.9486, lng: -3.1999, heading: 200, pitch: -5, zoom: 0 },
  { name: 'New York City, USA', lat: 40.758, lng: -73.9855, heading: 25, pitch: 30, zoom: 0 },
  { name: 'San Francisco, USA', lat: 37.8014, lng: -122.4116, heading: 90, pitch: 0, zoom: 0 },
  { name: 'Havana, Cuba', lat: 23.1398, lng: -82.3828, heading: 150, pitch: 5, zoom: 0 },
  { name: 'Buenos Aires, Argentina', lat: -34.6118, lng: -58.3732, heading: 60, pitch: 5, zoom: 0 },
  { name: 'Rio de Janeiro, Brazil', lat: -22.9466, lng: -43.1823, heading: 280, pitch: 15, zoom: 0 },
  { name: 'Cape Town, South Africa', lat: -33.9231, lng: 18.4137, heading: 180, pitch: 5, zoom: 0 },
  { name: 'Marrakech, Morocco', lat: 31.6258, lng: -7.9892, heading: 45, pitch: 0, zoom: 0 },
  { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784, heading: 300, pitch: 10, zoom: 0 },
  { name: 'Amsterdam, Netherlands', lat: 52.3731, lng: 4.8922, heading: 210, pitch: 5, zoom: 0 },
  { name: 'Prague, Czechia', lat: 50.0865, lng: 14.4114, heading: 90, pitch: 10, zoom: 0 },
  { name: 'Budapest, Hungary', lat: 47.498, lng: 19.0399, heading: 180, pitch: 10, zoom: 0 },
  { name: 'Santorini, Greece', lat: 36.4618, lng: 25.3753, heading: 270, pitch: 0, zoom: 0 },
  { name: 'Barcelona, Spain', lat: 41.3825, lng: 2.1764, heading: 45, pitch: 20, zoom: 0 },
  { name: 'Lisbon, Portugal', lat: 38.7121, lng: -9.1415, heading: 120, pitch: 5, zoom: 0 },
  { name: 'Seoul, South Korea', lat: 37.58, lng: 126.9844, heading: 150, pitch: 5, zoom: 0 },
  { name: 'Hanoi, Vietnam', lat: 21.0333, lng: 105.85, heading: 90, pitch: 5, zoom: 0 },
  { name: 'Bangkok, Thailand', lat: 13.7431, lng: 100.5018, heading: 200, pitch: 10, zoom: 0 },
];
