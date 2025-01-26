import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Camera, CheckCircle, XCircle } from 'lucide-react'
import { VerificationResult } from './verification-result'
import { verificationApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function FaceScanStep({ onBack, apiKey }: { onBack: () => void, apiKey: string | null }) {
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast();
    const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    if (isCameraActive) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [isCameraActive])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Error accessing the camera:", err)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
    }
  }

  const handleStartScan = async () => {
    setIsCameraActive(true)
    setIsScanning(true)
    // Simulate scanning process
    setTimeout(async () => {
      setIsScanning(false)
      setScanComplete(true)
      setIsCameraActive(false)
      captureImage()
         try {
           const image = canvasRef.current?.toDataURL('image/png');
             if (image && apiKey) {
               const response = await fetch("https://api-inference.huggingface.co/models/nateraw/vit-age-classifier", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        inputs: image
                    })
                 });
                 const data = await response.json();
                 if (response.ok && data && data[0]?.label) {
                     const age = parseInt(data[0].label.split('-')[0])
                     setAge(age)
                    const isAgeVerified = age >= 18;
                    setVerificationResult(isAgeVerified);
                         if(apiKey && isAgeVerified) {
                             await verificationApi.saveVerificationResult(apiKey, {
                                 success: isAgeVerified,
                                 method: "facescan",
                                 timestamp: Date.now(),
                                userId: 'test-user'
                            })
                        }
                 } else {
                       toast({
                           variant: "destructive",
                           title: "Chyba ověření",
                           description: data.error || "Nepodařilo se ověřit věk pomocí FaceScan.",
                       });
                       setVerificationResult(false);
                 }
             }
         } catch (error: any) {
                console.error("Error during FaceScan:", error);
                   toast({
                       variant: "destructive",
                       title: "Chyba ověření",
                       description: `Nepodařilo se ověřit věk pomocí FaceScan: ${error.message}`,
                   });
                 setVerificationResult(null);
         }
    }, 3000);
  }


  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }

  if (verificationResult !== null) {
    return <VerificationResult isVerified={verificationResult} />
  }

  return (
    <div className="max-w-md mx-auto">
      <Button
        variant="ghost"
        className="mb-6 text-primary hover:text-primary-light"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Zpět na výběr metody
      </Button>
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-primary mb-4">FaceScan</h2>
          <p className="text-gray-light mb-6">
            Pro ověření věku prosím naskenujte svůj obličej. Ujistěte se, že jste v dobře osvětleném prostředí a dívejte se přímo do kamery.
          </p>
          <div className="relative aspect-video mb-4 bg-gray-100 rounded-lg overflow-hidden">
            {isCameraActive && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {!isCameraActive && scanComplete && (
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-4 border-primary rounded-full animate-ping" />
              </div>
            )}
            {scanComplete && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary bg-opacity-50">
                {verificationResult === null ? (
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : verificationResult ? (
                  <CheckCircle className="w-16 h-16 text-white" />
                ) : (
                  <XCircle className="w-16 h-16 text-white" />
                )}
              </div>
            )}
          </div>
          {!scanComplete && (
            <Button
              onClick={handleStartScan}
              disabled={isScanning}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              {isScanning ? 'Skenování...' : 'Zahájit skenování'}
              <Camera className="ml-2 h-4 w-4" />
            </Button>
          )}
          {scanComplete && verificationResult === null && (
            <p className="text-center text-primary font-semibold">
              Skenování dokončeno! Probíhá ověřování věku...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}