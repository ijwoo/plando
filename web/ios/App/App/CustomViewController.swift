//
//  CustomViewController.swift
//  App
//
//  Created by jaewoo on 5/10/26.
//

import Foundation

import UIKit
import Capacitor
                                                                                                                        
class CustomViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(WidgetBridge())
        bridge?.registerPluginInstance(GeofencePlugin())
    }
}
