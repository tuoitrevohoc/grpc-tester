import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as protobuf from 'protobufjs';
import * as path from 'path';

export interface ProtoDefinition {
  services: string[];
  methods: Record<string, string[]>; // service -> methods
  filePath: string;
}

export class GrpcClientHelper {
  static async loadProto(filePath: string): Promise<ProtoDefinition> {
    try {
        const packageDefinition = await protoLoader.load(filePath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        // Load into grpc object to get Client Constructors
        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        
        const services: string[] = [];
        const methods: Record<string, string[]> = {};

        // Helper to traverse the GrpcObject
        function traverse(obj: any, path: string = '') {
            for (const key in obj) {
                const item = obj[key];
                
                // Check if it's a Service Client Constructor
                // In grpc-js, service clients are functions and have a 'service' property
                if (typeof item === 'function' && 'service' in item) {
                    const serviceName = path ? `${path}.${key}` : key;
                    services.push(serviceName);
                    methods[serviceName] = Object.keys(item.service);
                } 
                // Traverse deeper for packages (GrpcObject)
                else if (typeof item === 'object' && item !== null && !('format' in item)) { // avoid message types if they appear here (usually they don't in GrpcObject)
                     // In GrpcObject, packages are just objects. 
                     // Be careful strictly not to recurse into non-package objects if any.
                     // Service Constructor prototypes shouldn't be recursed.
                     // The constructor check above handles services.
                     traverse(item, path ? `${path}.${key}` : key);
                }
            }
        }

        traverse(protoDescriptor);
        
        if(services.length === 0) {
            console.warn(`No services found in ${filePath}.`);
        }

        return { services, methods, filePath };
    } catch(e) {
        console.error("Error loading proto:", e);
        throw e;
    }
  }

  static async generateSampleMessage(filePath: string, serviceName: string, methodName: string): Promise<any> {
    try {
      const root = await protobuf.load(filePath);
      
      // Look for the service
      const service = root.lookupService(serviceName);
      if (!service) return {};

      // Look for the method
      const method = service.methods[methodName];
      if (!method) return {};

      // Look for the request type
      const requestType = root.lookupType(method.requestType);
      
      // Create a sample object
      // toObject with defaults:true will fill in default values
      const sample = requestType.toObject(requestType.create({}), { defaults: true });
      
      return sample; 
    } catch (e) {
      console.error("Error generating sample:", e);
      return {};
    }
  }

  static async makeRequest(
      filePath: string, 
      serviceName: string, 
      methodName: string, 
      endpoint: string, 
      requestBody: any, 
      metadata: Record<string, string> = {}
    ): Promise<any> {
        
        const packageDefinition = await protoLoader.load(filePath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        
        // Navigate to the service. serviceName might be 'package.Service'
        const keys = serviceName.split('.');
        let serviceConstructor: any = protoDescriptor;
        for (const key of keys) {
            serviceConstructor = serviceConstructor[key];
        }

        if (!serviceConstructor) {
            throw new Error(`Service ${serviceName} not found`);
        }

        const client = new serviceConstructor(endpoint, grpc.credentials.createInsecure());
        
        const meta = new grpc.Metadata();
        for (const [k, v] of Object.entries(metadata)) {
            meta.add(k, v);
        }

        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5);

        return new Promise((resolve, reject) => {
            console.log(`[gRPC] Connecting to ${endpoint}...`);
            client.waitForReady(deadline, (err: Error) => {
                if (err) {
                    console.error("[gRPC] Connection failed:", err);
                    reject(new Error("Connection timeout: " + err.message));
                    return;
                }
                console.log(`[gRPC] Connected. Invoking ${methodName}...`);
                try {
                    client[methodName](requestBody, meta, { deadline: deadline }, (err: any, response: any) => {
                        if (err) {
                            console.error("[gRPC] Request failed:", err);
                            // gRPC errors often have 'details' or 'message'
                            reject(err);
                        } else {
                            console.log("[gRPC] Request successful");
                            resolve(response);
                        }
                    });
                } catch(e) {
                    console.error("[gRPC] Synchronous error invocation:", e);
                    reject(e);
                }
            });
        });
  }
}
