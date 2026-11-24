// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "EthiopiaMaps",
    platforms: [.iOS(.v13), .macOS(.v11)],
    products: [.library(name: "EthiopiaMaps", targets: ["EthiopiaMaps"])],
    dependencies: [
        // Same MapLibre Native as @ethiopiamaps/react-native; reads pmtiles:// itself
        .package(url: "https://github.com/maplibre/maplibre-gl-native-distribution", exact: "6.31.0"),
    ],
    targets: [
        .target(
            name: "EthiopiaMaps",
            dependencies: [.product(name: "MapLibre", package: "maplibre-gl-native-distribution", condition: .when(platforms: [.iOS, .macOS]))],
            resources: [.copy("Resources")]
        ),
        .testTarget(name: "EthiopiaMapsTests", dependencies: ["EthiopiaMaps"]),
    ]
)
