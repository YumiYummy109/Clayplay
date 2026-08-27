"""
扫描设备的所有 GATT 服务和特征，用于确认控制通道。
用法：python scan.py
"""
import asyncio
from bleak import BleakScanner, BleakClient

async def main():
    print("🔍 扫描 SX176A ...")
    devs = await BleakScanner.discover(timeout=6.0)
    dev = next((d for d in devs if d.name and "SX176A" in d.name), None)
    if not dev:
        print("⚠️ 没找到设备"); return
    print(f"✅ 找到：{dev.name}  {dev.address}\n")
    async with BleakClient(dev) as c:
        for svc in c.services:
            print(f"[服务] {svc.uuid}  {svc.description}")
            for ch in svc.characteristics:
                props = ",".join(ch.properties)
                print(f"    [特征] {ch.uuid}  [{props}]  {ch.description}")

asyncio.run(main())
