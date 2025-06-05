#include <WiFi.h>
#include <FirebaseESP32.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// === Konfigurasi Pin ===
#define ONE_WIRE_BUS 11   // Pin untuk sensor DS18B20 (OneWire)
#define DHTPIN 10         // Pin untuk sensor DHT22 (hanya kelembaban)
#define DHTTYPE DHT22
#define BUZZER_PIN 3
#define RELAY_AC_PIN 2
#define LED_PIN 4

// === WiFi & Firebase ===
#define WIFI_SSID "hazel"
#define WIFI_PASSWORD "101112131415"
#define API_KEY "AIzaSyArYS7xfCDH3gMzeZLJED1pukchN9oPAJQ"
#define DATABASE_URL "https://temperature-project-80671-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "lSqnsVaINYZCjgiryUOSt4p9mxhDGkz2OPljnmz4"

// === Firebase Config & Auth ===
FirebaseAuth auth;
FirebaseConfig config;
FirebaseData firebaseData;

// === Sensor DHT22 untuk kelembaban ===
DHT dht(DHTPIN, DHTTYPE);

// === Sensor DS18B20 untuk suhu ===
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void connectToWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("\nMenghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nTerhubung ke WiFi!");
}

void connectToFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  while (!Firebase.ready()) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nFirebase siap!");
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  sensors.begin();

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_AC_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(RELAY_AC_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  connectToWiFi();
  connectToFirebase();
}

void nyalakanBuzzer() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(300);
  digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  // Ambil suhu dari DS18B20
  sensors.requestTemperatures();
  float suhu = sensors.getTempCByIndex(0);

  // Ambil kelembaban dari DHT22
  float kelembaban = dht.readHumidity();

  if (isnan(suhu) || isnan(kelembaban)) {
    Serial.println("Gagal membaca sensor suhu atau kelembaban!");
    delay(5000);
    return;
  }

  Serial.print("Suhu: ");
  Serial.print(suhu);
  Serial.println(" °C");

  Serial.print("Kelembaban: ");
  Serial.print(kelembaban+25);
  Serial.println(" %");

  // Kirim data sensor ke Firebase
  if (Firebase.ready()) {
    Firebase.setFloat(firebaseData, "/temp", suhu);
    float kelembabanTerkoreksi = kelembaban + 25;
    Firebase.setFloat(firebaseData, "/humid", kelembabanTerkoreksi);

    // Ambil mode operasi
    String mode = "manual";
    if (Firebase.getString(firebaseData, "/mode")) {
      mode = firebaseData.stringData();
    }

    // Baca status manual & AI
    String statusManualAc = "", statusManualHumid = "";
    String prediksiAc = "", prediksiHumid = "";

    Firebase.getString(firebaseData, "/manual_status/ac") && (statusManualAc = firebaseData.stringData());
    Firebase.getString(firebaseData, "/manual_status/humid") && (statusManualHumid = firebaseData.stringData());

    Firebase.getString(firebaseData, "/output/prediksi_ac") && (prediksiAc = firebaseData.stringData());
    Firebase.getString(firebaseData, "/output/prediksi_humid") && (prediksiHumid = firebaseData.stringData());

    // Tentukan status ON/OFF
    bool acOn = false;
    bool humidOn = false;

    if (mode == "manual") {
      acOn = (statusManualAc == "ON");
      humidOn = (statusManualHumid == "ON");
    } else if (mode == "auto") {
      acOn = (prediksiAc == "ON");
      humidOn = (prediksiHumid == "ON");
    }

    // Kontrol AC (relay dan LED)
    digitalWrite(RELAY_AC_PIN, acOn ? HIGH : LOW);
    digitalWrite(LED_PIN, acOn ? HIGH : LOW);

    // Jika AC atau Humidifier menyala, buzzer bunyi
    if (acOn || humidOn) {
      Serial.println("BUZZER: ON (karena AC/Humidifier aktif)");
      nyalakanBuzzer();
    } else {
      Serial.println("BUZZER: OFF");
    }

    Serial.print("AC: ");
    Serial.println(acOn ? "NYALA" : "MATI");
    Serial.print("Humidifier (indikasi): ");
    Serial.println(humidOn ? "YA (BUZZER)" : "TIDAK");
  } else {
    Serial.println("Firebase belum siap.");
  }

  delay(3000);
}
