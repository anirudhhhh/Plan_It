import {createHash} from 'node:crypto';
// Stable UUIDs make seed migrations repeatable without using human labels as keys.
export function seedId(label){const bytes=createHash('sha1').update(`plan-it-pilot:${label}`).digest().subarray(0,16);bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
