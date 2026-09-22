import type { Chip } from '../types';

export const chips: Chip[] = [
  {
    id: 'stm32f103c8t6',
    name: 'STM32F103C8T6',
    manufacturer: 'STMicroelectronics',
    series: 'STM32F1',
    cores: 'Cortex-M3',
    frequency: '72MHz',
    flash: '64KB',
    ram: '20KB',
    peripherals: ['USART', 'SPI', 'I2C', 'TIM', 'ADC', 'USB', 'CAN'],
    package: 'LQFP48',
  },
  {
    id: 'stm32f407vet6',
    name: 'STM32F407VET6',
    manufacturer: 'STMicroelectronics',
    series: 'STM32F4',
    cores: 'Cortex-M4',
    frequency: '168MHz',
    flash: '512KB',
    ram: '192KB',
    peripherals: ['USART', 'SPI', 'I2C', 'TIM', 'ADC', 'USB', 'CAN', 'ETH', 'DMA', 'SDIO'],
    package: 'LQFP100',
  },
  {
    id: 'esp32s3',
    name: 'ESP32-S3',
    manufacturer: 'Espressif',
    series: 'ESP32',
    cores: 'Xtensa LX7 Dual-Core',
    frequency: '240MHz',
    flash: '8MB (external)',
    ram: '512KB',
    peripherals: ['UART', 'SPI', 'I2C', 'I2S', 'PWM', 'USB', 'LCD', 'CAM'],
    package: 'QFN',
  },
  {
    id: 'gd32f103c8t6',
    name: 'GD32F103C8T6',
    manufacturer: 'GigaDevice',
    series: 'GD32F10x',
    cores: 'Cortex-M3',
    frequency: '108MHz',
    flash: '128KB',
    ram: '32KB',
    peripherals: ['USART', 'SPI', 'I2C', 'TIM', 'ADC', 'USB', 'CAN'],
    package: 'LQFP48',
  },
  {
    id: 'atmega328p',
    name: 'ATmega328P',
    manufacturer: 'Microchip',
    series: 'AVR',
    cores: 'AVR 8-bit',
    frequency: '20MHz',
    flash: '32KB',
    ram: '2KB',
    peripherals: ['USART', 'SPI', 'I2C', 'TIM', 'ADC', 'PWM'],
    package: 'DIP-28 / SOP-28',
  },
  {
    id: 'rp2040',
    name: 'RP2040',
    manufacturer: 'Raspberry Pi',
    series: 'RP2040',
    cores: 'Dual Cortex-M0+',
    frequency: '133MHz',
    flash: 'External QSPI',
    ram: '264KB',
    peripherals: ['UART', 'SPI', 'I2C', 'PIO', 'PWM', 'USB', 'ADC'],
    package: 'QFN56 / QFN64',
  },
];

export function getChipsByManufacturer(manufacturer: string): Chip[] {
  return chips.filter((c) => c.manufacturer === manufacturer);
}

export function getChipById(id: string): Chip | undefined {
  return chips.find((c) => c.id === id);
}

export const manufacturers = [...new Set(chips.map((c) => c.manufacturer))];
