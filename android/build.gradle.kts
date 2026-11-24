plugins {
    id("com.android.library") version "9.2.1"
}

android {
    namespace = "et.ethiopiamaps"
    compileSdk = 37
    defaultConfig { minSdk = 23 }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    // Same MapLibre Native as @ethiopiamaps/react-native; reads pmtiles:// itself
    api("org.maplibre.gl:android-sdk:13.6.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517") // android.jar's org.json is a stub in JVM tests
}
