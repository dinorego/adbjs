import child_process from 'child_process';
import fs from 'fs';

export default class ADB {
 
  constructor() {
    this.device = [];
    this.selected_device;
  }

  version() {
    
    let child = child_process.spawnSync("adb", ["version"]);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    return child.stdout.toString().trim().replace("/\r?\n|\r/ig", "");
  }

  devices() {
      
    let child = child_process.spawnSync("adb", ["devices"]);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }

    let output = child.stdout.toString();
    let match_devices = output.match(/(emulator-)?[\w\d]+\s+device\n/ig);
    
    if(match_devices == null) return this.device;
    if(!match_devices.length) return this.device;
    
    for(let k in match_devices) {

      let match_device = match_devices[k].split(/\n/);
      for(let i in match_devices) {
        if(match_devices[i] == "") continue;
        if(!/device/ig.test(match_devices[i])) continue;
        let did = match_devices[i].replace(/\tdevice/ig, "");
            did = did.replace(/\n/ig, "");
        if(this.device.indexOf(did) != -1) continue;

        let device_info = this.deviceInfo(did);
        this.device.push(device_info);
      }
    }
    
    this.selected_device = this.selected_device || this.device[0];
    return this.device;
  }

  userProcessList(device) {
    
    if(!this.isDeviceAvailable(device)) {
      throw new Error("No device selected");
      return;
    }
    let child = child_process.spawnSync("adb", ["-s", device, "shell", "ps"]);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    let output = child.stdout.toString().split("\r\n");
    let list = [];
    for(let i=0;i<output.length;i++) {
      try {
        let process = output[i];
        if(!/u\d_\w\d+/.test(process)) continue;
        process = process.split(/\s+/);
        process = {
          user : process[0],
          pid : process[1],
          pkg : process[8]
        }
        list.push(process);
      }catch(e){}
    }
    return list;
  }

  deviceInfo(device) {
    
    let info = {
      id: device
    };

    let child = child_process.spawnSync("adb", ["-s", device, "shell", "getprop", "ro.product.model"]);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    info.model = child.stdout.toString().replace(/\r?\n|\r/ig,"");
    
    child = child_process.spawnSync("adb", ["-s", device, "shell", "getprop", "ro.build.version.release"]);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    info.version = child.stdout.toString().replace(/\r?\n|\r/ig,"");
    return info;
  }

  selectDevice(device) {
    this.selected_device = device;
  }
  
  isPackageInstalled(_package_) {
    
    let packages = this.listPackages();
    for(let i in packages)
      if(packages[i] == _package_) return true;
    
    return false;
  }

  promptUninstall(_package_) {

    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }
    
    let params = ["shell", "am" ,"start", "-a", "android.intent.action.DELETE", "-d", "package:"+_package_];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }

    let child = child_process.spawnSync("adb", params);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    let output = child.stdout.toString().trim().replace(/\r?\n|\r/,"");
    return output;
  }

  uninstall(_package_) {
    
    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }
    
    let params = ["shell", "pm", "uninstall", "-k", _package_];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }
    let child = child_process.spawnSync("adb", params);
    return !this.isPackageInstalled(_package_);

  }

  install(apk_path, _package_) {
    
    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }

    if(!fs.existsSync(apk_path)) throw new Error("Apk file not found!");

    let params = ["install", apk_path];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }
    let child = child_process.spawnSync("adb", params);
    return this.isPackageInstalled(_package_);
  }

  packageInfo(_package_) {
    
    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }
    
    let params = ["shell", "dumpsys", "package", _package_];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }
    let child = child_process.spawnSync("adb", params);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
    }
    
    let output = child.stdout.toString().trim().replace(/\r?\n|\r/ig, "");
    if(output == "") 
      throw new Error("Package not found");
    
    let info = {
      id: _package_  
    }
    info.versionCode = output.match(/versionCode=\d+/)[0].replace(/versionCode=/,"");
    info.versionName = output.match(/versionName=[\d\.\w]+/)[0].replace(/versionName=/,"");
    info.targetSdk = output.match(/targetSdk=\d+/)[0].replace(/targetSdk=/,"");
    return info;
  }

  isAppRunning(_package_) {

    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }

    let params = ["shell" ,"ps"];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }
    
    let child = child_process.spawnSync("adb", params);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
    }

    let output = child.stdout.toString();
    return output.indexOf(_package_) != -1 ? true : false;
  }

  closeApp(_package_) {

    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }
    
    let params = ["shell" ,"am", "force-stop", _package_];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }
    
    let child = child_process.spawnSync("adb", params);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
    }
  }

  listPackages() {
   
    if(!this.selected_device) {
      throw new Error("No device selected");
      return;
    }
    let did = this.selected_device.id;
    if(!this.isDeviceAvailable(did)) {
      throw new Error("Device no longer available");
      return;
    }
    
    let params = ["shell" ,"pm", "list", "packages"];
    if(did) {
      params.unshift(did);
      params.unshift("-s");
    }

    let child = child_process.spawnSync("adb", params);
    if(child.stderr && child.stderr.toString() !="") { 
      throw new Error(" "+child.stderr);
      return;
    }
    
    let output = child.stdout.toString();
    let list = output.split(/\n/);
    
    let packages = [];
    if(!list.length) return packages;
    for(let i in list) {
      
      if(list[i] == "") continue;

      let pkg = list[i];
          pkg = pkg.replace("package:","");
          pkg = pkg.replace(/\r/,"");

      packages.push(pkg);
    }

    return packages;
  }

  isDeviceAvailable(device_id) {
    try {
      let devices = this.devices();
      for(let i in devices) 
        if(devices[i].id == device_id)
          return true;

    }catch(e) {}
    return false;
  }

};
