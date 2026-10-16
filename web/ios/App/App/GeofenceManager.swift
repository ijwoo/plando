//
//  GeofenceManager.swift
//  App
//
//  Singleton — CLLocationManager 기반 백그라운드 지오펜싱.
//  AppDelegate 에서 초기화하여 앱이 종료된 상태에서도 region 진입 이벤트를 받을 수 있도록 함.
//  인증 정보는 WidgetBridge 가 저장한 App Group UserDefaults 를 공유.
//

import Foundation
import CoreLocation

final class GeofenceManager: NSObject, CLLocationManagerDelegate {
    static let shared = GeofenceManager()

    private let locationManager = CLLocationManager()
    private let appGroupID = "group.com.imjaewoo.plando"
    private let regionPrefix = "plando_"

    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
    }

    func requestAlwaysAuthorization() {
        locationManager.requestAlwaysAuthorization()
    }

    // MARK: - Geofence CRUD

    func addGeofence(todoId: String, latitude: Double, longitude: Double, radius: Double) {
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
            NSLog("[Plando][Geofence] Region monitoring not available on this device")
            return
        }
        let clampedRadius = min(radius, locationManager.maximumRegionMonitoringDistance)
        let region = CLCircularRegion(
            center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
            radius: CLLocationDistance(clampedRadius),
            identifier: "\(regionPrefix)\(todoId)"
        )
        region.notifyOnEntry = true
        region.notifyOnExit = false
        locationManager.startMonitoring(for: region)
    }

    func removeGeofence(todoId: String) {
        let identifier = "\(regionPrefix)\(todoId)"
        for region in locationManager.monitoredRegions where region.identifier == identifier {
            locationManager.stopMonitoring(for: region)
            break
        }
    }

    func removeAllGeofences() {
        for region in locationManager.monitoredRegions where region.identifier.hasPrefix(regionPrefix) {
            locationManager.stopMonitoring(for: region)
        }
    }

    func getMonitoredTodoIds() -> [String] {
        locationManager.monitoredRegions
            .filter { $0.identifier.hasPrefix(regionPrefix) }
            .map { String($0.identifier.dropFirst(regionPrefix.count)) }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard region.identifier.hasPrefix(regionPrefix) else { return }
        let todoId = String(region.identifier.dropFirst(regionPrefix.count))
        NSLog("[Plando][Geofence] didEnterRegion todo=\(todoId)")
        notifyBackend(todoId: todoId)
    }

    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        NSLog("[Plando][Geofence] monitoringDidFail region=\(region?.identifier ?? "nil") error=\(error.localizedDescription)")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        NSLog("[Plando][Geofence] authorizationStatus=\(manager.authorizationStatus.rawValue)")
    }

    // MARK: - Backend API call

    private func notifyBackend(todoId: String) {
        guard let store = UserDefaults(suiteName: appGroupID),
              let token = store.string(forKey: "plando.widget.authToken"), !token.isEmpty,
              let workspaceId = store.string(forKey: "plando.widget.workspaceId"), !workspaceId.isEmpty,
              let apiBase = store.string(forKey: "plando.widget.apiBase"), !apiBase.isEmpty,
              let url = URL(string: "\(apiBase)/api/triggers/enter/\(todoId)") else {
            NSLog("[Plando][Geofence] Missing credentials — skipping backend notify for todo=\(todoId)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(workspaceId, forHTTPHeaderField: "X-Workspace-Id")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let task = URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                NSLog("[Plando][Geofence] Backend error: \(error.localizedDescription)")
                return
            }
            if let http = response as? HTTPURLResponse {
                NSLog("[Plando][Geofence] Backend response: \(http.statusCode) todo=\(todoId)")
            }
        }
        task.resume()
    }
}
