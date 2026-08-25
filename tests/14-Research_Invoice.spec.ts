import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import { attachRuntimeMonitors } from './support/runtimeMonitors';
import { setCustomerOrder } from '../Variable';
const fs = require('fs');
const path = require('path');

//@Outamate DS:
test(' Order Creation ', async ({ page }) => {
    





});