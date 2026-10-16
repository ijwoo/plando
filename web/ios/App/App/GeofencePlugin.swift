//
//  GeofencePlugin.swift
//  App
//
//  Capacitor 플러그인 — JS 에서 호출해 iOS 네이티브 지오펜스를 등록/해제.
//
//  JS 사용 예:
//      import { registerPlugin } from "@capacitor/core";
//      const Geofence = registerPlugin("Geofence");
//      await Geofence.register({ todoId: "123", lat: 37.5, lng: 127.0, radius: 200 });
//      await Geofence.remove({ todoId: "123" });
//      await Geofence.removeAll();
//      const { ids } = await Geofence.getMonitored();
//

import Foundation
import Capacitor
import CoreLocation

@objc(GeofencePlugin)
public class GeofencePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GeofencePlugin"
    public let jsName = "Geofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMonitored", returnType: CAPPluginReturnPromise),
    ]

    @objc func requestPermission(_ call: CAPPluginCall) {
        GeofenceManager.shared.requestAlwaysAuthorization()
        call.resolve(["success": true])
    }

    @objc func register(_ call: CAPPluginCall) {
        guard let todoId = call.getString("todoId"),
              let lat = call.getDouble("lat"),
              let lng = call.getDouble("lng") else {
            call.reject("Missing required parameters: todoId, lat, lng")
            return
        }
        let radius = call.getDouble("radius") ?? 200.0

        GeofenceManager.shared.requestAlwaysAuthorization()
        GeofenceManager.shared.addGeofence(
            todoId: todoId, latitude: lat, longitude: lng, radius: radius
        )
        NSLog("[Plando][GeofencePlugin] register todo=\(todoId) radius=\(radius)m")
        call.resolve(["success": true])
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let todoId = call.getString("todoId") else {
            call.reject("Missing todoId")
            return
        }
        GeofenceManager.shared.removeGeofence(todoId: todoId)
        NSLog("[Plando][GeofencePlugin] remove todo=\(todoId)")
        call.resolve(["success": true])
    }

    @objc func removeAll(_ call: CAPPluginCall) {
        GeofenceManager.shared.removeAllGeofences()
        NSLog("[Plando][GeofencePlugin] removeAll")
        call.resolve(["success": true])
    }

    @objc func getMonitored(_ call: CAPPluginCall) {
        let ids = GeofenceManager.shared.getMonitoredTodoIds()
        call.resolve(["ids": ids])
    }
}
