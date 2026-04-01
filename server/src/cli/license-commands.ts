// src/cli/license-commands.ts
// @ts-expect-error ESM/CJS interop for CLI path
import { ClientLicenseValidator } from '../licensing/client-validator';
import prompts from 'prompts';
import chalk from 'chalk';

export class LicenseCLI {
  private validator: ClientLicenseValidator;
  
  constructor() {
    this.validator = new ClientLicenseValidator();
  }
  
  async activate(): Promise<void> {
    console.log(chalk.bold.cyan('\n License Activation\n'));
    
    const response = await prompts({
      type: 'text',
      name: 'licenseKey',
      message: 'Enter your license key:',
      validate: (value) => value.length > 0 || 'License key required',
    });
    
    if (!response.licenseKey) {
      console.log(chalk.yellow('Activation cancelled'));
      return;
    }
    
    console.log(chalk.gray('Activating license...'));
    
    const result = await this.validator.activateLicense(response.licenseKey);
    
    if (result.success) {
      console.log(chalk.green.bold('\n License activated successfully!'));
      console.log(chalk.gray('You can now use the Content Generation Engine.\n'));
    } else {
      console.log(chalk.red.bold('\n Activation failed'));
      console.log(chalk.red(`Reason: ${result.reason}\n`));
    }
  }
  
  async validate(): Promise<void> {
    console.log(chalk.bold.cyan('\n License Validation\n'));
    
    const response = await prompts({
      type: 'text',
      name: 'licenseKey',
      message: 'Enter license key to validate:',
      validate: (value) => value.length > 0 || 'License key required',
    });
    
    if (!response.licenseKey) {
      return;
    }
    
    console.log(chalk.gray('Validating...'));
    
    const result = await this.validator.validateOnline(response.licenseKey);
    
    if (result.valid && result.license) {
      console.log(chalk.green.bold('\n Valid License\n'));
      console.log(chalk.white('Product:'), chalk.cyan(result.license.productName));
      console.log(chalk.white('Purchase Date:'), chalk.cyan(new Date(result.license.purchaseDate).toLocaleDateString()));
      console.log(chalk.white('Activations:'), chalk.cyan(`${result.license.activationCount} / ${result.license.maxActivations}`));
      console.log();
    } else {
      console.log(chalk.red.bold('\n Invalid License\n'));
      console.log(chalk.red(`Reason: ${result.reason}\n`));
    }
  }
  
  async deactivate(): Promise<void> {
    console.log(chalk.bold.cyan('\n License Deactivation\n'));
    
    const response = await prompts({
      type: 'text',
      name: 'licenseKey',
      message: 'Enter license key to deactivate:',
      validate: (value) => value.length > 0 || 'License key required',
    });
    
    if (!response.licenseKey) {
      return;
    }
    
    const confirm = await prompts({
      type: 'confirm',
      name: 'value',
      message: 'Are you sure you want to deactivate this license on this machine?',
      initial: false,
    });
    
    if (!confirm.value) {
      console.log(chalk.yellow('Deactivation cancelled'));
      return;
    }
    
    console.log(chalk.gray('Deactivating...'));
    
    const success = await this.validator.deactivateLicense(response.licenseKey);
    
    if (success) {
      console.log(chalk.green.bold('\n License deactivated successfully\n'));
    } else {
      console.log(chalk.red.bold('\n Deactivation failed\n'));
    }
  }
}

// Add to main CLI
// src/cli/index.ts
// import { LicenseCLI } from './license-commands';

const licenseCLI = new LicenseCLI();

// Add commands
if (process.argv[2] === 'license') {
  const subcommand = process.argv[3];
  
  switch (subcommand) {
    case 'activate':
      licenseCLI.activate();
      break;
    case 'validate':
      licenseCLI.validate();
      break;
    case 'deactivate':
      licenseCLI.deactivate();
      break;
    default:
      console.log('Usage: content-engine license [activate|validate|deactivate]');
  }
}